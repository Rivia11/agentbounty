import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type PublicClient,
  type WalletClient
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '../utils/logger.js';

const USDC_ADDRESSES = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
} as const;

const USDC_DECIMALS = 6;

const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false }
    ]
  }
] as const;

export interface PaymentRequest {
  taskId: string;
  amount: string;
  currency: 'USDC';
  network: 'base' | 'base-sepolia';
  recipient: `0x${string}`;
  validUntil: string;
  description: string;
}

export interface PaymentProof {
  txHash: `0x${string}`;
  network: 'base' | 'base-sepolia';
}

export interface PaymentVerification {
  valid: boolean;
  sender?: `0x${string}`;
  amount?: string;
  error?: string;
}

export class X402PaymentHandler {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: ReturnType<typeof privateKeyToAccount>;
  private network: 'base' | 'base-sepolia';
  private usdcAddress: `0x${string}`;

  constructor(privateKey: `0x${string}`, network: 'base' | 'base-sepolia' = 'base') {
    this.network = network;
    this.account = privateKeyToAccount(privateKey);

    const chain = network === 'base' ? base : baseSepolia;

    this.publicClient = createPublicClient({
      chain,
      transport: http()
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain,
      transport: http()
    });

    this.usdcAddress = USDC_ADDRESSES[network];
  }

  async getAddress(): Promise<`0x${string}`> {
    return this.account.address;
  }

  async getBalance(): Promise<string> {
    try {
      const balance = await this.publicClient.readContract({
        address: this.usdcAddress,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [this.account.address]
      });

      return formatUnits(balance as bigint, USDC_DECIMALS);
    } catch (error) {
      logger.error('Failed to get balance:', error);
      return '0';
    }
  }

  generatePaymentRequest(
    taskId: string,
    amount: string,
    description: string,
    validMinutes: number = 30
  ): PaymentRequest {
    return {
      taskId,
      amount,
      currency: 'USDC',
      network: this.network,
      recipient: this.account.address,
      validUntil: new Date(Date.now() + validMinutes * 60 * 1000).toISOString(),
      description
    };
  }

  formatHttp402Response(request: PaymentRequest): {
    status: 402;
    headers: Record<string, string>;
    body: object;
  } {
    return {
      status: 402,
      headers: {
        'X-Payment-Required': 'true',
        'X-Payment-Protocol': 'x402',
        'X-Payment-Currency': request.currency,
        'X-Payment-Network': request.network,
        'X-Payment-Amount': request.amount,
        'X-Payment-Recipient': request.recipient,
        'X-Payment-Valid-Until': request.validUntil,
        'X-Payment-Task-Id': request.taskId
      },
      body: {
        error: 'payment_required',
        message: 'Payment is required to process this request',
        payment: request,
        paymentUrl: this.generatePaymentDeepLink(request)
      }
    };
  }

  generatePaymentDeepLink(request: PaymentRequest): string {
    const amountWei = parseUnits(request.amount, USDC_DECIMALS);

    // Coinbase Wallet deep link
    const cbParams = new URLSearchParams({
      address: this.usdcAddress,
      uint256: amountWei.toString(),
      function: 'transfer(address,uint256)',
      args: JSON.stringify([request.recipient, amountWei.toString()])
    });

    // Also generate a universal link that works with most wallets
    const universalLink = `ethereum:${this.usdcAddress}/transfer?address=${request.recipient}&uint256=${amountWei}`;

    return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(universalLink)}&chain=base`;
  }

  async verifyPayment(
    proof: PaymentProof,
    expectedAmount: string,
    expectedSender?: `0x${string}`
  ): Promise<PaymentVerification> {
    try {
      // Get transaction receipt
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: proof.txHash
      });

      if (!receipt) {
        return { valid: false, error: 'Transaction not found' };
      }

      if (receipt.status !== 'success') {
        return { valid: false, error: 'Transaction failed' };
      }

      // Find USDC Transfer event
      const transferLog = receipt.logs.find(log =>
        log.address.toLowerCase() === this.usdcAddress.toLowerCase() &&
        log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // Transfer event signature
      );

      if (!transferLog) {
        return { valid: false, error: 'No USDC transfer found in transaction' };
      }

      // Decode transfer event
      const sender = `0x${transferLog.topics[1]?.slice(26)}` as `0x${string}`;
      const recipient = `0x${transferLog.topics[2]?.slice(26)}` as `0x${string}`;
      const amount = BigInt(transferLog.data);

      // Verify recipient is our address
      if (recipient.toLowerCase() !== this.account.address.toLowerCase()) {
        return { valid: false, error: 'Payment sent to wrong address' };
      }

      // Verify amount
      const expectedAmountWei = parseUnits(expectedAmount, USDC_DECIMALS);
      if (amount < expectedAmountWei) {
        return {
          valid: false,
          error: `Insufficient payment: received ${formatUnits(amount, USDC_DECIMALS)} USDC, expected ${expectedAmount} USDC`
        };
      }

      // Verify sender if specified
      if (expectedSender && sender.toLowerCase() !== expectedSender.toLowerCase()) {
        return { valid: false, error: 'Payment from unexpected sender' };
      }

      logger.payment('Verified', formatUnits(amount, USDC_DECIMALS), proof.txHash);

      return {
        valid: true,
        sender,
        amount: formatUnits(amount, USDC_DECIMALS)
      };
    } catch (error) {
      logger.error('Payment verification failed:', error);
      return {
        valid: false,
        error: `Verification failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async sendPayment(
    to: `0x${string}`,
    amount: string
  ): Promise<{ success: boolean; txHash?: `0x${string}`; error?: string }> {
    try {
      const amountWei = parseUnits(amount, USDC_DECIMALS);

      // Check balance
      const balance = await this.publicClient.readContract({
        address: this.usdcAddress,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [this.account.address]
      });

      if ((balance as bigint) < amountWei) {
        return { success: false, error: 'Insufficient balance' };
      }

      // Send transaction
      const txHash = await this.walletClient.writeContract({
        address: this.usdcAddress,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [to, amountWei]
      });

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status !== 'success') {
        return { success: false, error: 'Transaction failed' };
      }

      logger.payment('Sent', amount, txHash);

      return { success: true, txHash };
    } catch (error) {
      logger.error('Payment send failed:', error);
      return {
        success: false,
        error: `Payment failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
