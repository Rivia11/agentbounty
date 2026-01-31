import Anthropic from '@anthropic-ai/sdk';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// Polymarket API endpoints
const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

interface Market {
  id: string;
  condition_id: string;
  question: string;
  description: string;
  outcomes: string[];
  outcome_prices: string[];
  tokens: { token_id: string; outcome: string }[];
  volume: string;
  end_date_iso: string;
  active: boolean;
}

interface OrderBook {
  market: string;
  asset_id: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
}

interface Position {
  marketId: string;
  question: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
}

interface TradeResult {
  success: boolean;
  orderId?: string;
  market: string;
  side: 'YES' | 'NO';
  amount: number;
  price: number;
  error?: string;
}

export class PolymarketTrader {
  private anthropic: Anthropic;
  private positions: Position[] = [];
  private tradingEnabled = false;
  private dailySpent = 0;
  private lastResetDate = new Date().toDateString();
  private apiKey: string;
  private privateKey: string;

  // Risk limits
  private readonly MAX_BET_SIZE = config.limits.maxPolymarketBet;
  private readonly MAX_DAILY_TRADING = config.limits.maxDailyPolymarket;
  private readonly MIN_EDGE_REQUIRED = 0.15; // 15% edge required

  constructor() {
    this.anthropic = new Anthropic({ apiKey: config.ai.apiKey });
    this.apiKey = config.polymarket.apiKey;
    this.privateKey = config.polymarket.privateKey;
    this.tradingEnabled = config.polymarket.enabled && !!this.apiKey && !!this.privateKey;
  }

  /**
   * Get active markets from Polymarket
   */
  async getActiveMarkets(limit = 50): Promise<Market[]> {
    try {
      const response = await fetch(
        `${GAMMA_API}/markets?active=true&closed=false&limit=${limit}&order=volume&ascending=false`
      );

      if (!response.ok) {
        throw new Error(`Gamma API error: ${response.status}`);
      }

      const markets = await response.json();
      return markets;
    } catch (error) {
      logger.error('Failed to fetch markets:', error);
      return [];
    }
  }

  /**
   * Get market details
   */
  async getMarket(conditionId: string): Promise<Market | null> {
    try {
      const response = await fetch(`${GAMMA_API}/markets/${conditionId}`);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to fetch market:', error);
      return null;
    }
  }

  /**
   * Get order book for a token
   */
  async getOrderBook(tokenId: string): Promise<OrderBook | null> {
    try {
      const response = await fetch(`${CLOB_API}/book?token_id=${tokenId}`);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to fetch order book:', error);
      return null;
    }
  }

  /**
   * Get price history for a token
   */
  async getPriceHistory(tokenId: string, interval = '1h', fidelity = 60): Promise<{
    t: number[];
    p: number[];
  } | null> {
    try {
      const response = await fetch(
        `${CLOB_API}/prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`
      );

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to fetch price history:', error);
      return null;
    }
  }

  /**
   * Find trading opportunities
   */
  async findOpportunities(): Promise<{
    marketId: string;
    question: string;
    currentPrice: number;
    fairPrice: number;
    edge: number;
    side: 'YES' | 'NO';
    confidence: number;
    reasoning: string;
  }[]> {
    if (!this.tradingEnabled) {
      logger.warn('Polymarket trading not enabled');
      return [];
    }

    logger.info('Scanning Polymarket for opportunities...');

    try {
      const markets = await this.getActiveMarkets(30);
      const opportunities = [];

      for (const market of markets) {
        if (!market.active || !market.tokens?.length) continue;

        // Get current YES price
        const yesPrice = parseFloat(market.outcome_prices?.[0] || '0.5');

        // Skip if price is too extreme (likely already resolved)
        if (yesPrice < 0.05 || yesPrice > 0.95) continue;

        // Analyze with Claude
        const analysis = await this.analyzeMarket(market);

        if (analysis.edge >= this.MIN_EDGE_REQUIRED) {
          opportunities.push({
            marketId: market.condition_id,
            question: market.question,
            currentPrice: yesPrice,
            fairPrice: analysis.fairPrice,
            edge: analysis.edge,
            side: analysis.side,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning
          });
        }
      }

      logger.info(`Found ${opportunities.length} trading opportunities`);

      return opportunities.sort((a, b) => b.edge - a.edge);
    } catch (error) {
      logger.error('Failed to find opportunities:', error);
      return [];
    }
  }

  /**
   * Analyze a market using Claude
   */
  private async analyzeMarket(market: Market): Promise<{
    fairPrice: number;
    edge: number;
    side: 'YES' | 'NO';
    confidence: number;
    reasoning: string;
  }> {
    const yesPrice = parseFloat(market.outcome_prices?.[0] || '0.5');

    try {
      const response = await this.anthropic.messages.create({
        model: config.ai.model,
        max_tokens: 500,
        system: `You are a prediction market analyst. Analyze markets and estimate fair probabilities.
Be calibrated - don't be overconfident. Consider base rates and update based on evidence.
Current date: ${new Date().toISOString().split('T')[0]}`,
        messages: [{
          role: 'user',
          content: `Analyze this prediction market:

Question: ${market.question}
Description: ${market.description || 'No description'}
Current YES price: ${yesPrice}
Volume: $${parseInt(market.volume || '0').toLocaleString()}
End Date: ${market.end_date_iso}

Return JSON only:
{
  "fairProbability": 0.0-1.0,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation (max 100 chars)"
}`
        }]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      const analysis = JSON.parse(text);

      const fairPrice = analysis.fairProbability;
      const edge = Math.abs(fairPrice - yesPrice);
      const side = fairPrice > yesPrice ? 'YES' : 'NO';

      return {
        fairPrice,
        edge,
        side,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning
      };
    } catch (error) {
      return {
        fairPrice: yesPrice,
        edge: 0,
        side: 'YES',
        confidence: 0,
        reasoning: 'Analysis failed'
      };
    }
  }

  /**
   * Execute a trade (requires API key and proper authentication)
   */
  async executeTrade(
    marketId: string,
    side: 'YES' | 'NO',
    amount: number,
    confidence: number
  ): Promise<TradeResult> {
    // Reset daily counter if new day
    if (new Date().toDateString() !== this.lastResetDate) {
      this.dailySpent = 0;
      this.lastResetDate = new Date().toDateString();
    }

    // Check limits
    if (amount > this.MAX_BET_SIZE) {
      return {
        success: false,
        market: marketId,
        side,
        amount,
        price: 0,
        error: `Exceeds max bet size (${this.MAX_BET_SIZE} USDC)`
      };
    }

    if (this.dailySpent + amount > this.MAX_DAILY_TRADING) {
      return {
        success: false,
        market: marketId,
        side,
        amount,
        price: 0,
        error: `Exceeds daily trading limit (${this.MAX_DAILY_TRADING} USDC)`
      };
    }

    // Apply Kelly criterion for position sizing
    const kellyAmount = this.calculateKellyBet(amount, confidence);

    try {
      // Get market details to find token ID
      const market = await this.getMarket(marketId);
      if (!market) {
        return {
          success: false,
          market: marketId,
          side,
          amount,
          price: 0,
          error: 'Market not found'
        };
      }

      // Find the right token (YES or NO)
      const tokenIndex = side === 'YES' ? 0 : 1;
      const tokenId = market.tokens?.[tokenIndex]?.token_id;

      if (!tokenId) {
        return {
          success: false,
          market: marketId,
          side,
          amount,
          price: 0,
          error: 'Token not found'
        };
      }

      // Get order book for current price
      const orderBook = await this.getOrderBook(tokenId);
      const currentPrice = orderBook?.asks?.[0]?.price
        ? parseFloat(orderBook.asks[0].price)
        : parseFloat(market.outcome_prices?.[tokenIndex] || '0.5');

      // In production, you would:
      // 1. Create and sign the order using CLOB API
      // 2. Submit to POST /order endpoint
      // 3. This requires proper L1/L2 authentication headers

      // For now, log the intended trade
      logger.payment(`Polymarket ${side}`, kellyAmount.toString());
      logger.info(`Would trade: ${side} on "${market.question}" @ ${currentPrice} for ${kellyAmount} USDC`);

      this.dailySpent += kellyAmount;

      return {
        success: true,
        orderId: `sim_${Date.now()}`,
        market: marketId,
        side,
        amount: kellyAmount,
        price: currentPrice
      };
    } catch (error) {
      return {
        success: false,
        market: marketId,
        side,
        amount,
        price: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Calculate Kelly bet size
   */
  private calculateKellyBet(maxBet: number, confidence: number): number {
    // Fractional Kelly (25%) to be conservative
    const kellyFraction = 0.25;
    const adjustedAmount = maxBet * confidence * kellyFraction;

    // Round to 2 decimal places, minimum $1
    return Math.max(1, Math.round(adjustedAmount * 100) / 100);
  }

  /**
   * Get current positions (from local tracking)
   */
  getPositions(): Position[] {
    return this.positions;
  }

  /**
   * Get daily trading stats
   */
  getDailyStats(): { spent: number; limit: number; remaining: number } {
    return {
      spent: this.dailySpent,
      limit: this.MAX_DAILY_TRADING,
      remaining: this.MAX_DAILY_TRADING - this.dailySpent
    };
  }

  /**
   * Check if trading is enabled
   */
  isEnabled(): boolean {
    return this.tradingEnabled;
  }
}
