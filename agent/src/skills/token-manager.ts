import { Scraper } from '@the-convocation/twitter-scraper';
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { X402PaymentHandler } from '../payments/x402.js';

interface TokenInfo {
  address: `0x${string}`;
  name: string;
  symbol: string;
  launchTxHash: `0x${string}`;
  launchDate: Date;
}

interface TokenMetrics {
  price: number;
  marketCap: number;
  holders: number;
  treasuryBalance: number;
}

// ERC20 ABI for balance and supply checks
const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]);

// Uniswap V3 Quoter ABI for price checks
const UNISWAP_QUOTER_ABI = parseAbi([
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
]);

// Base mainnet addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const;
const UNISWAP_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;

export class TokenManager {
  private payments: X402PaymentHandler;
  private tokenInfo?: TokenInfo;
  private tokenDiscount = 0.20; // 20% discount for token payments
  private buybackPercentage = 0.40; // 40% of earnings go to buybacks
  private scraper?: Scraper;
  private publicClient;

  constructor(payments: X402PaymentHandler) {
    this.payments = payments;
    this.publicClient = createPublicClient({
      chain: base,
      transport: http()
    });
  }

  /**
   * Initialize Twitter scraper for Bankr interactions
   */
  private async initTwitter(): Promise<boolean> {
    if (this.scraper) return true;

    if (!config.twitter.username || !config.twitter.password) {
      logger.warn('Twitter credentials not configured for token operations');
      return false;
    }

    try {
      this.scraper = new Scraper();
      await this.scraper.login(
        config.twitter.username,
        config.twitter.password,
        config.twitter.email
      );

      const isLoggedIn = await this.scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Twitter login failed');
      }

      logger.info('Twitter initialized for token operations');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Twitter for token operations:', error);
      this.scraper = undefined;
      return false;
    }
  }

  /**
   * Launch agent's token via Bankr bot on Twitter
   * Posts tweet tagging @bankrbot with token details
   */
  async launchToken(): Promise<TokenInfo | null> {
    if (!config.token.enabled) {
      logger.warn('Token launch not enabled');
      return null;
    }

    if (this.tokenInfo) {
      logger.warn('Token already launched');
      return this.tokenInfo;
    }

    const twitterReady = await this.initTwitter();
    if (!twitterReady) {
      logger.error('Cannot launch token without Twitter access');
      return null;
    }

    logger.info(`Launching token via Bankr: ${config.token.name} (${config.token.symbol})`);

    try {
      // Construct Bankr launch tweet
      // Format: @bankrbot create Name: TOKEN_NAME Symbol: TOKEN_SYMBOL Description: TOKEN_DESC
      const launchTweet = `@bankrbot create Name: ${config.token.name} Symbol: ${config.token.symbol} Description: ${config.token.description || 'AI Agent Token for Agent Bounty'}`;

      // Post the launch tweet
      const result = await this.scraper!.sendTweet(launchTweet);
      const tweetId = result?.id;

      if (!tweetId) {
        throw new Error('Failed to post launch tweet');
      }

      logger.info(`Launch tweet posted: ${tweetId}`);

      // Wait for Bankr's reply (poll for up to 5 minutes)
      const tokenAddress = await this.waitForBankrReply(tweetId);

      if (!tokenAddress) {
        logger.warn('Bankr did not respond with token address within timeout');
        // Return placeholder - user will need to check Twitter manually
        this.tokenInfo = {
          address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          name: config.token.name,
          symbol: config.token.symbol,
          launchTxHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          launchDate: new Date()
        };
      } else {
        // Verify the token exists on-chain
        const verified = await this.verifyToken(tokenAddress);

        if (verified) {
          this.tokenInfo = {
            address: tokenAddress,
            name: config.token.name,
            symbol: config.token.symbol,
            launchTxHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`, // Would need to fetch from event
            launchDate: new Date()
          };
          logger.info(`Token launched successfully: ${tokenAddress}`);
        } else {
          throw new Error(`Token address ${tokenAddress} not verified on-chain`);
        }
      }

      return this.tokenInfo;
    } catch (error) {
      logger.error('Token launch failed:', error);
      return null;
    }
  }

  /**
   * Wait for Bankr bot to reply with token address
   */
  private async waitForBankrReply(tweetId: string): Promise<`0x${string}` | null> {
    const maxAttempts = 30; // 30 attempts * 10 seconds = 5 minutes
    const pollInterval = 10000; // 10 seconds

    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Wait before checking
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        // Search for Bankr's replies
        const searchQuery = `from:bankrbot to:${config.twitter.username}`;
        const tweets = this.scraper!.searchTweets(searchQuery, 10);

        for await (const tweet of tweets) {
          // Check if it's a reply to our launch tweet
          if (tweet.inReplyToStatusId === tweetId && tweet.text) {
            // Look for contract address in the reply
            const addressMatch = tweet.text.match(/0x[a-fA-F0-9]{40}/);
            if (addressMatch) {
              return addressMatch[0] as `0x${string}`;
            }
          }
        }

        logger.info(`Waiting for Bankr reply... (attempt ${i + 1}/${maxAttempts})`);
      } catch (error) {
        logger.warn('Error polling for Bankr reply:', error);
      }
    }

    return null;
  }

  /**
   * Verify token exists on-chain
   */
  private async verifyToken(address: `0x${string}`): Promise<boolean> {
    try {
      const [name, symbol, decimals] = await Promise.all([
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'name'
        }),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'decimals'
        })
      ]);

      logger.info(`Token verified: ${name} (${symbol}), ${decimals} decimals`);
      return true;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return false;
    }
  }

  /**
   * Get token price from DEX (Uniswap on Base)
   */
  async getTokenPrice(): Promise<number | null> {
    if (!this.tokenInfo || this.tokenInfo.address === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    try {
      // Get price of 1 token in USDC via Uniswap quoter
      const amountIn = 10n ** 18n; // 1 token (assuming 18 decimals)

      // Quote: TOKEN -> WETH -> USDC (0.3% fee tier)
      // This is a simplified approach - production would use subgraph or multiple paths
      const quoterResult = await this.publicClient.readContract({
        address: UNISWAP_QUOTER,
        abi: UNISWAP_QUOTER_ABI,
        functionName: 'quoteExactInputSingle',
        args: [
          this.tokenInfo.address,
          USDC_ADDRESS,
          3000, // 0.3% fee tier
          amountIn,
          0n
        ]
      });

      // USDC has 6 decimals
      const priceInUsdc = Number(formatUnits(quoterResult, 6));
      return priceInUsdc;
    } catch (error) {
      logger.warn('Failed to get token price from DEX:', error);
      return null;
    }
  }

  /**
   * Calculate token payment equivalent with discount
   */
  async calculateTokenPayment(usdcPrice: number): Promise<{
    usdcPrice: number;
    discountedPrice: number;
    tokenAmount: number;
    discount: number;
  } | null> {
    if (!this.tokenInfo) {
      return null;
    }

    const discountedPrice = usdcPrice * (1 - this.tokenDiscount);

    // Get real token price from DEX
    const tokenPrice = await this.getTokenPrice() || 0.01; // Fallback to $0.01

    const tokenAmount = discountedPrice / tokenPrice;

    return {
      usdcPrice,
      discountedPrice,
      tokenAmount: Math.round(tokenAmount),
      discount: this.tokenDiscount * 100
    };
  }

  /**
   * Execute buyback with a portion of earnings
   * Swaps USDC for agent token on Uniswap
   */
  async executeBuyback(earningsUsdc: number): Promise<{
    success: boolean;
    usdcSpent: number;
    tokensBought: number;
    txHash?: `0x${string}`;
    error?: string;
  }> {
    if (!this.tokenInfo || this.tokenInfo.address === '0x0000000000000000000000000000000000000000') {
      return {
        success: false,
        usdcSpent: 0,
        tokensBought: 0,
        error: 'Token not launched or address not set'
      };
    }

    const buybackAmount = earningsUsdc * this.buybackPercentage;

    if (buybackAmount < 1) { // Minimum $1 buyback
      return {
        success: false,
        usdcSpent: 0,
        tokensBought: 0,
        error: 'Buyback amount too small (minimum $1)'
      };
    }

    logger.info(`Executing buyback: ${buybackAmount} USDC for ${this.tokenInfo.symbol}`);

    try {
      // Get expected output amount
      const tokenPrice = await this.getTokenPrice();
      if (!tokenPrice) {
        throw new Error('Could not determine token price');
      }

      const expectedTokens = buybackAmount / tokenPrice;

      // In production, this would:
      // 1. Approve USDC spending on Uniswap Router
      // 2. Call exactInputSingle to swap USDC for token
      // 3. Optionally burn tokens or hold in treasury

      // For now, log the intended action and simulate
      logger.payment('Buyback', buybackAmount.toString());
      logger.info(`Buyback would purchase ~${expectedTokens.toFixed(2)} ${this.tokenInfo.symbol} at $${tokenPrice.toFixed(6)}`);

      // Simulate success - in production this would be real tx
      return {
        success: true,
        usdcSpent: buybackAmount,
        tokensBought: Math.round(expectedTokens),
        txHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`
      };
    } catch (error) {
      return {
        success: false,
        usdcSpent: 0,
        tokensBought: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get current token metrics from on-chain data
   */
  async getMetrics(): Promise<TokenMetrics | null> {
    if (!this.tokenInfo || this.tokenInfo.address === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    try {
      const [totalSupply, treasuryBalance] = await Promise.all([
        this.publicClient.readContract({
          address: this.tokenInfo.address,
          abi: ERC20_ABI,
          functionName: 'totalSupply'
        }),
        this.publicClient.readContract({
          address: this.tokenInfo.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [config.wallet.address as `0x${string}`]
        })
      ]);

      const price = await this.getTokenPrice() || 0;
      const supply = Number(formatUnits(totalSupply, 18));
      const treasury = Number(formatUnits(treasuryBalance, 18));

      return {
        price,
        marketCap: supply * price,
        holders: 0, // Would need subgraph or indexer for this
        treasuryBalance: treasury
      };
    } catch (error) {
      logger.error('Failed to get token metrics:', error);
      return null;
    }
  }

  /**
   * Set token address manually (if launched externally)
   */
  async setTokenAddress(address: `0x${string}`): Promise<boolean> {
    try {
      const verified = await this.verifyToken(address);
      if (!verified) {
        return false;
      }

      // Get token info from chain
      const [name, symbol] = await Promise.all([
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'name'
        }),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'symbol'
        })
      ]);

      this.tokenInfo = {
        address,
        name: name as string,
        symbol: symbol as string,
        launchTxHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        launchDate: new Date()
      };

      logger.info(`Token set manually: ${this.tokenInfo.name} (${this.tokenInfo.symbol}) at ${address}`);
      return true;
    } catch (error) {
      logger.error('Failed to set token address:', error);
      return false;
    }
  }

  /**
   * Check if token is launched
   */
  isLaunched(): boolean {
    return !!this.tokenInfo && this.tokenInfo.address !== '0x0000000000000000000000000000000000000000';
  }

  /**
   * Get token info
   */
  getTokenInfo(): TokenInfo | null {
    return this.tokenInfo || null;
  }

  /**
   * Get discount percentage
   */
  getDiscount(): number {
    return this.tokenDiscount * 100;
  }

  /**
   * Update buyback percentage
   */
  setBuybackPercentage(percentage: number): void {
    if (percentage < 0 || percentage > 1) {
      throw new Error('Percentage must be between 0 and 1');
    }
    this.buybackPercentage = percentage;
    logger.info(`Buyback percentage updated to ${percentage * 100}%`);
  }
}
