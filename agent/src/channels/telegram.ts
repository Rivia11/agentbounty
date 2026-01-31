import { logger } from '../utils/logger.js';
import type { AgentCore, IncomingMessage, AgentResponse } from '../core.js';

interface TelegramConfig {
  token: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    reply_to_message?: {
      message_id: number;
    };
  };
}

export class TelegramChannel {
  private agent: AgentCore;
  private config: TelegramConfig;
  private pollInterval?: NodeJS.Timeout;
  private lastUpdateId = 0;
  private connected = false;
  private baseUrl: string;

  constructor(agent: AgentCore, config: TelegramConfig) {
    this.agent = agent;
    this.config = config;
    this.baseUrl = `https://api.telegram.org/bot${config.token}`;
  }

  async connect(): Promise<void> {
    logger.info('Connecting to Telegram...');

    try {
      // Verify bot token by getting bot info
      const me = await this.apiCall('getMe');
      logger.info(`Telegram connected as @${me.username}`);

      this.connected = true;

      // Start polling for updates
      this.startPolling();
    } catch (error) {
      logger.error('Telegram connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.connected = false;
    logger.info('Telegram disconnected');
  }

  private async apiCall(method: string, params?: Record<string, unknown>): Promise<any> {
    const url = `${this.baseUrl}/${method}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: params ? JSON.stringify(params) : undefined
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  private startPolling(): void {
    const poll = async () => {
      if (!this.connected) return;

      try {
        const updates: TelegramUpdate[] = await this.apiCall('getUpdates', {
          offset: this.lastUpdateId + 1,
          timeout: 30,
          allowed_updates: ['message']
        });

        for (const update of updates) {
          this.lastUpdateId = update.update_id;

          if (update.message?.text) {
            await this.handleMessage(update.message);
          }
        }
      } catch (error) {
        logger.error('Error polling Telegram:', error);
      }

      // Continue polling
      if (this.connected) {
        setTimeout(poll, 1000);
      }
    };

    poll();
  }

  private async handleMessage(message: TelegramUpdate['message']): Promise<void> {
    if (!message || !message.text) return;

    logger.info(`Telegram message from ${message.from.username || message.from.id}: ${message.text.slice(0, 50)}...`);

    const incomingMessage: IncomingMessage = {
      channel: 'telegram',
      channelMessageId: message.message_id.toString(),
      senderId: message.from.id.toString(),
      content: message.text,
      replyTo: message.reply_to_message?.message_id.toString()
    };

    const response = await this.agent.handleMessage(incomingMessage);

    await this.sendMessage(message.chat.id, response);
  }

  private async sendMessage(chatId: number, response: AgentResponse): Promise<void> {
    const text = this.formatMessage(response);

    await this.apiCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false
    });
  }

  private formatMessage(response: AgentResponse): string {
    let text = response.content;

    if (response.requiresPayment) {
      text += `\n\n💰 *Pay ${response.requiresPayment.amount} USDC*\n`;
      text += `[Pay Now](${response.requiresPayment.paymentUrl})`;
    }

    if (response.taskId) {
      text += `\n\n_Task ID: ${response.taskId}_`;
    }

    return text;
  }
}

export async function createTelegramChannel(agent: AgentCore, config: TelegramConfig): Promise<TelegramChannel> {
  const channel = new TelegramChannel(agent, config);
  await channel.connect();
  return channel;
}
