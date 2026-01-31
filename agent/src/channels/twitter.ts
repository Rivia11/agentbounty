import { Scraper, Tweet, SearchMode } from '@the-convocation/twitter-scraper';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type { AgentCore, IncomingMessage, AgentResponse } from '../core.js';

interface TwitterConfig {
  username: string;
  password: string;
  email: string;
}

export class TwitterChannel {
  private agent: AgentCore;
  private config: TwitterConfig;
  private scraper: Scraper;
  private pollInterval?: NodeJS.Timeout;
  private processedTweetIds = new Set<string>();
  private connected = false;
  private rateLimitBackoff = 30000; // Start with 30 second polling

  constructor(agent: AgentCore, config: TwitterConfig) {
    this.agent = agent;
    this.config = config;
    this.scraper = new Scraper();
  }

  async connect(): Promise<void> {
    logger.info('Connecting to Twitter/X...');

    try {
      // Login with credentials
      await this.scraper.login(
        this.config.username,
        this.config.password,
        this.config.email
      );

      // Verify login
      const isLoggedIn = await this.scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Failed to verify Twitter login');
      }

      this.connected = true;
      logger.info(`Twitter connected as @${this.config.username}`);

      // Start polling for mentions
      this.startPolling();

    } catch (error) {
      logger.error('Twitter connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    await this.scraper.logout();
    this.connected = false;
    logger.info('Twitter disconnected');
  }

  private startPolling(): void {
    const pollMentions = async () => {
      if (!this.connected) return;

      try {
        // Search for mentions of our username
        const searchQuery = `@${this.config.username}`;
        const tweets = this.scraper.searchTweets(searchQuery, 20, SearchMode.Latest);

        for await (const tweet of tweets) {
          // Skip if already processed
          if (this.processedTweetIds.has(tweet.id!)) {
            continue;
          }

          // Skip our own tweets
          if (tweet.username?.toLowerCase() === this.config.username.toLowerCase()) {
            continue;
          }

          this.processedTweetIds.add(tweet.id!);
          await this.handleMention(tweet);

          // Keep processed set from growing too large
          if (this.processedTweetIds.size > 1000) {
            const idsArray = Array.from(this.processedTweetIds);
            this.processedTweetIds = new Set(idsArray.slice(-500));
          }
        }

        // Reset backoff on success
        this.rateLimitBackoff = 30000;

      } catch (error: any) {
        logger.error('Error polling Twitter mentions:', error);

        // Handle rate limiting
        if (error.message?.includes('rate limit') || error.status === 429) {
          this.rateLimitBackoff = Math.min(this.rateLimitBackoff * 2, 300000); // Max 5 min
          logger.warn(`Rate limited, backing off to ${this.rateLimitBackoff / 1000}s`);
        }
      }

      // Schedule next poll
      if (this.connected) {
        setTimeout(pollMentions, this.rateLimitBackoff);
      }
    };

    // Initial poll after 5 seconds
    setTimeout(pollMentions, 5000);
  }

  private async handleMention(tweet: Tweet): Promise<void> {
    if (!tweet.text || !tweet.id || !tweet.userId) {
      return;
    }

    logger.info(`Twitter mention from @${tweet.username}: ${tweet.text.slice(0, 80)}...`);

    // Remove @mention from text
    const cleanText = tweet.text
      .replace(new RegExp(`@${this.config.username}\\s*`, 'gi'), '')
      .trim();

    // Skip empty mentions or just mentions without content
    if (!cleanText || cleanText.length < 3) {
      return;
    }

    const message: IncomingMessage = {
      channel: 'twitter',
      channelMessageId: tweet.id,
      senderId: tweet.userId,
      content: cleanText,
      replyTo: tweet.inReplyToStatusId
    };

    try {
      const response = await this.agent.handleMessage(message);
      await this.reply(tweet.id, response);
    } catch (error) {
      logger.error('Error handling Twitter mention:', error);
    }
  }

  private async reply(tweetId: string, response: AgentResponse): Promise<void> {
    try {
      const replyText = this.formatReply(response);

      // Send reply
      // @ts-expect-error - sendTweet exists but types may be incomplete
      await this.scraper.sendTweet(replyText, tweetId);

      logger.info(`Replied to tweet ${tweetId}`);
    } catch (error) {
      logger.error('Failed to reply to tweet:', error);
    }
  }

  private formatReply(response: AgentResponse): string {
    let text = response.content;

    // If there's a payment requirement, we need to include it
    if (response.requiresPayment) {
      // Twitter has 280 char limit, so we need to be concise
      const paymentInfo = `\n\n💰 ${response.requiresPayment.amount} USDC\n${response.requiresPayment.paymentUrl}`;
      const maxContentLength = 280 - paymentInfo.length;

      if (text.length > maxContentLength) {
        text = text.slice(0, maxContentLength - 3) + '...';
      }

      text += paymentInfo;
    } else {
      // Truncate if too long
      if (text.length > 277) {
        text = text.slice(0, 274) + '...';
      }
    }

    return text;
  }

  /**
   * Post a tweet (not a reply)
   */
  async postTweet(text: string): Promise<string | null> {
    try {
      // @ts-expect-error - sendTweet exists but types may be incomplete
      const result = await this.scraper.sendTweet(text);
      logger.info(`Posted tweet: ${text.slice(0, 50)}...`);
      return result?.id || null;
    } catch (error) {
      logger.error('Failed to post tweet:', error);
      return null;
    }
  }

  /**
   * Search tweets
   */
  async searchTweets(query: string, limit = 20): Promise<Tweet[]> {
    const tweets: Tweet[] = [];
    try {
      const results = this.scraper.searchTweets(query, limit, SearchMode.Latest);
      for await (const tweet of results) {
        tweets.push(tweet);
        if (tweets.length >= limit) break;
      }
    } catch (error) {
      logger.error('Tweet search failed:', error);
    }
    return tweets;
  }

  /**
   * Get a specific tweet by ID
   */
  async getTweet(tweetId: string): Promise<Tweet | null> {
    try {
      return await this.scraper.getTweet(tweetId);
    } catch (error) {
      logger.error('Failed to get tweet:', error);
      return null;
    }
  }

  /**
   * Like a tweet
   */
  async likeTweet(tweetId: string): Promise<boolean> {
    try {
      // @ts-expect-error - likeTweet exists but types may be incomplete
      await this.scraper.likeTweet(tweetId);
      return true;
    } catch (error) {
      logger.error('Failed to like tweet:', error);
      return false;
    }
  }

  /**
   * Get user profile
   */
  async getProfile(username: string) {
    try {
      return await this.scraper.getProfile(username);
    } catch (error) {
      logger.error('Failed to get profile:', error);
      return null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

export async function createTwitterChannel(
  agent: AgentCore,
  config: TwitterConfig
): Promise<TwitterChannel> {
  const channel = new TwitterChannel(agent, config);
  await channel.connect();
  return channel;
}
