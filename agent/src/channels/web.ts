import express, { type Express, type Request, type Response } from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import type { AgentCore, IncomingMessage, AgentResponse } from '../core.js';

interface WebConfig {
  port: number;
}

interface WebSocketMessage {
  type: 'message' | 'payment_verify' | 'status';
  content?: string;
  taskId?: string;
  txHash?: string;
}

export class WebChannel {
  private agent: AgentCore;
  private config: WebConfig;
  private app: Express;
  private wss?: WebSocketServer;
  private clients = new Map<string, WebSocket>();

  constructor(agent: AgentCore, config: WebConfig) {
    this.agent = agent;
    this.config = config;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use(express.json());

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment-Proof');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Agent info
    this.app.get('/agent', async (req, res) => {
      const { payments, taskQueue } = this.agent as any;
      const stats = await taskQueue.getStats();

      res.json({
        name: 'Agent Bounty',
        version: '1.0.0',
        wallet: await payments.getAddress(),
        balance: await payments.getBalance(),
        stats
      });
    });

    // Create task / send message
    this.app.post('/message', async (req: Request, res: Response) => {
      try {
        const { content, senderAddress } = req.body;

        if (!content) {
          return res.status(400).json({ error: 'Content is required' });
        }

        const message: IncomingMessage = {
          channel: 'web',
          channelMessageId: randomUUID(),
          senderId: senderAddress || 'anonymous',
          senderAddress: senderAddress as `0x${string}` | undefined,
          content
        };

        const response = await this.agent.handleMessage(message);

        // Check if payment is required
        if (response.requiresPayment) {
          const { payments } = this.agent as any;
          const paymentRequest = payments.generatePaymentRequest(
            response.requiresPayment.taskId,
            response.requiresPayment.amount,
            content.slice(0, 100)
          );

          const http402 = payments.formatHttp402Response(paymentRequest);

          return res.status(402).json(http402.body);
        }

        res.json({
          success: true,
          response: response.content,
          taskId: response.taskId
        });
      } catch (error) {
        logger.error('Web message error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Verify payment
    this.app.post('/payment/verify', async (req: Request, res: Response) => {
      try {
        const { taskId, txHash, sender } = req.body;

        if (!taskId || !txHash) {
          return res.status(400).json({ error: 'taskId and txHash are required' });
        }

        const message: IncomingMessage = {
          channel: 'web',
          channelMessageId: randomUUID(),
          senderId: sender || 'anonymous',
          senderAddress: sender as `0x${string}` | undefined,
          content: `PAYMENT:${taskId}:${txHash}`
        };

        const response = await this.agent.handleMessage(message);

        res.json({
          success: true,
          verified: response.content.includes('verified'),
          message: response.content,
          taskId: response.taskId
        });
      } catch (error) {
        logger.error('Payment verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get task status
    this.app.get('/task/:id', async (req: Request, res: Response) => {
      try {
        const { taskQueue } = this.agent as any;
        const task = await taskQueue.getTask(req.params.id);

        if (!task) {
          return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ task });
      } catch (error) {
        logger.error('Get task error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // List gigs (static for now)
    this.app.get('/gigs', (req, res) => {
      res.json({
        gigs: [
          {
            id: 'landing-page',
            title: 'Build a Landing Page',
            description: 'Get a modern, responsive landing page deployed to Vercel',
            category: 'website',
            basePrice: 25,
            deliveryTime: '30 minutes'
          },
          {
            id: 'deep-research',
            title: 'Deep Research Report',
            description: 'Comprehensive research on any topic with sources',
            category: 'research',
            basePrice: 5,
            deliveryTime: '15 minutes'
          },
          {
            id: 'tweet-thread',
            title: 'Viral Tweet Thread',
            description: 'Engaging 10-15 tweet thread on any topic',
            category: 'writing',
            basePrice: 10,
            deliveryTime: '20 minutes'
          },
          {
            id: 'code-review',
            title: 'Code Review',
            description: 'Security and quality review of your code',
            category: 'code',
            basePrice: 15,
            deliveryTime: '45 minutes'
          }
        ]
      });
    });
  }

  async start(): Promise<void> {
    const server = createServer(this.app);

    // Set up WebSocket server for real-time updates
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = randomUUID();
      this.clients.set(clientId, ws);

      logger.debug(`WebSocket client connected: ${clientId}`);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          await this.handleWebSocketMessage(clientId, ws, message);
        } catch (error) {
          logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.debug(`WebSocket client disconnected: ${clientId}`);
      });
    });

    return new Promise((resolve) => {
      server.listen(this.config.port, () => {
        logger.info(`Web server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  private async handleWebSocketMessage(
    clientId: string,
    ws: WebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    switch (message.type) {
      case 'message':
        if (message.content) {
          const incomingMessage: IncomingMessage = {
            channel: 'web',
            channelMessageId: randomUUID(),
            senderId: clientId,
            content: message.content
          };

          const response = await this.agent.handleMessage(incomingMessage);
          ws.send(JSON.stringify({ type: 'response', ...response }));
        }
        break;

      case 'status':
        if (message.taskId) {
          const { taskQueue } = this.agent as any;
          const task = await taskQueue.getTask(message.taskId);
          ws.send(JSON.stringify({ type: 'status', task }));
        }
        break;

      case 'payment_verify':
        if (message.taskId && message.txHash) {
          const verifyMessage: IncomingMessage = {
            channel: 'web',
            channelMessageId: randomUUID(),
            senderId: clientId,
            content: `PAYMENT:${message.taskId}:${message.txHash}`
          };

          const response = await this.agent.handleMessage(verifyMessage);
          ws.send(JSON.stringify({ type: 'payment_verified', ...response }));
        }
        break;
    }
  }

  // Broadcast to all connected clients
  broadcast(message: object): void {
    const data = JSON.stringify(message);
    for (const ws of this.clients.values()) {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(data);
      }
    }
  }

  async disconnect(): Promise<void> {
    for (const ws of this.clients.values()) {
      ws.close();
    }
    this.clients.clear();
    this.wss?.close();
  }
}
