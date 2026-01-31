'use client';

import { useState } from 'react';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';
import { Loader2, Wallet } from 'lucide-react';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
const AGENT_WALLET = process.env.NEXT_PUBLIC_AGENT_WALLET || '0x0000000000000000000000000000000000000000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  }
] as const;

interface PaymentButtonProps {
  gigId: string;
  priceUsdc: string;
  onSuccess: (taskId: string) => void;
}

export function PaymentButton({ gigId, priceUsdc, onSuccess }: PaymentButtonProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const [error, setError] = useState<string>('');
  const [taskId, setTaskId] = useState<string>('');

  const handlePayment = async () => {
    if (!isConnected || !address) {
      // Try to connect
      const connector = connectors[0];
      if (connector) {
        connect({ connector });
      }
      return;
    }

    setError('');

    try {
      // First, create the task and get payment details
      const response = await fetch(`${API_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `Order gig: ${gigId}`,
          senderAddress: address
        })
      });

      if (response.status === 402) {
        const paymentData = await response.json();
        setTaskId(paymentData.payment.taskId);

        // Send USDC transfer
        writeContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [
            paymentData.payment.recipient as `0x${string}`,
            parseUnits(priceUsdc, 6)
          ]
        });
      } else {
        const data = await response.json();
        if (data.taskId) {
          onSuccess(data.taskId);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    }
  };

  // Verify payment after transaction confirms
  const verifyPayment = async () => {
    if (!hash || !taskId) return;

    try {
      const response = await fetch(`${API_URL}/payment/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          txHash: hash,
          sender: address
        })
      });

      const data = await response.json();
      if (data.verified) {
        onSuccess(taskId);
      } else {
        setError('Payment verification failed');
      }
    } catch (err) {
      setError('Verification failed');
    }
  };

  // Call verify when transaction is confirmed
  if (isSuccess && taskId && hash) {
    verifyPayment();
  }

  if (!isConnected) {
    return (
      <button
        onClick={() => {
          const connector = connectors[0];
          if (connector) {
            connect({ connector });
          }
        }}
        className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition"
      >
        <Wallet className="w-5 h-5" />
        Connect Wallet
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handlePayment}
        disabled={isPending || isConfirming}
        className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition"
      >
        {(isPending || isConfirming) ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {isPending ? 'Confirm in wallet...' : 'Confirming...'}
          </>
        ) : (
          <>Pay {priceUsdc} USDC</>
        )}
      </button>

      {error && (
        <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
      )}

      <p className="text-xs text-[var(--muted)] text-center mt-3">
        Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
      </p>
    </div>
  );
}
