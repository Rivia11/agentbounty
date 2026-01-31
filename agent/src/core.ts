import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import type { X402PaymentHandler } from './payments/x402.js';
import type { PricingEngine } from './payments/pricing.js';
import type { TaskQueue, Task } from './queue/task-queue.js';
import type { MemoryStore } from './memory/store.js';
import type { A2AClient } from './a2a/client.js';
import type { SkillRegistry } from './skills/registry.js';

export interface AgentDeps {
  memory: MemoryStore;
  payments: X402PaymentHandler;
  pricing: PricingEngine;
  taskQueue: TaskQueue;
  a2a: A2AClient;
  skills: SkillRegistry;
}

export interface IncomingMessage {
  channel: 'twitter' | 'telegram' | 'discord' | 'web';
  channelMessageId: string;
  senderId: string;
  senderAddress?: `0x${string}`;
  content: string;
  replyTo?: string;
}

export interface AgentResponse {
  content: string;
  requiresPayment?: {
    taskId: string;
    amount: string;
    paymentUrl: string;
  };
  taskId?: string;
}

export class AgentCore {
  private anthropic: Anthropic;
  private memory: MemoryStore;
  private payments: X402PaymentHandler;
  private pricing: PricingEngine;
  private taskQueue: TaskQueue;
  private a2a: A2AClient;
  private skills: SkillRegistry;

  constructor(deps: AgentDeps) {
    this.anthropic = new Anthropic({ apiKey: config.ai.apiKey });
    this.memory = deps.memory;
    this.payments = deps.payments;
    this.pricing = deps.pricing;
    this.taskQueue = deps.taskQueue;
    this.a2a = deps.a2a;
    this.skills = deps.skills;
  }

  async handleMessage(message: IncomingMessage): Promise<AgentResponse> {
    logger.info(`📨 [${message.channel}] ${message.senderId}: ${message.content.slice(0, 100)}...`);

    // Check if this is a payment verification
    if (message.content.startsWith('PAYMENT:')) {
      return this.handlePaymentVerification(message);
    }

    // Check if this is a status check
    if (message.content.toLowerCase().includes('status')) {
      return this.handleStatusCheck(message);
    }

    // Analyze the message to determine intent
    const intent = await this.analyzeIntent(message.content);

    if (intent.type === 'bounty_request') {
      return this.handleBountyRequest(message, intent);
    }

    if (intent.type === 'question') {
      return this.handleQuestion(message);
    }

    // Default: conversational response
    return this.handleConversation(message);
  }

  private async analyzeIntent(content: string): Promise<{
    type: 'bounty_request' | 'question' | 'status_check' | 'conversation';
    category?: string;
    complexity?: 'simple' | 'medium' | 'complex';
    details?: string;
  }> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 500,
      system: `You analyze user messages to determine intent. Return JSON only.

Categories for bounty requests:
- research: finding information, analysis, reports
- website: building web pages, landing pages, apps
- writing: content creation, copywriting, documentation
- code: programming, debugging, code review
- design: visual design, UI/UX suggestions
- other: anything else`,
      messages: [{
        role: 'user',
        content: `Analyze this message and return JSON:

"${content}"

Return format:
{
  "type": "bounty_request" | "question" | "status_check" | "conversation",
  "category": "research" | "website" | "writing" | "code" | "design" | "other",
  "complexity": "simple" | "medium" | "complex",
  "details": "brief description of what they want"
}`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    try {
      return JSON.parse(text);
    } catch {
      return { type: 'conversation' };
    }
  }

  private async handleBountyRequest(
    message: IncomingMessage,
    intent: { category?: string; complexity?: string; details?: string }
  ): Promise<AgentResponse> {
    // Calculate price
    const price = this.pricing.calculate({
      category: intent.category || 'other',
      complexity: (intent.complexity as 'simple' | 'medium' | 'complex') || 'medium',
      estimatedTokens: 2000,
      toolsRequired: this.pricing.inferTools(intent.category || 'other')
    });

    // Create task
    const task = await this.taskQueue.createTask({
      channel: message.channel,
      channelMessageId: message.channelMessageId,
      senderId: message.senderId,
      senderAddress: message.senderAddress,
      description: message.content,
      category: intent.category || 'other',
      priceUsdc: price.total.toString(),
      status: 'pending_payment'
    });

    // Generate payment request
    const paymentRequest = this.payments.generatePaymentRequest(
      task.id,
      price.total.toString(),
      intent.details || message.content.slice(0, 100)
    );

    const paymentUrl = this.payments.generatePaymentDeepLink(paymentRequest);

    // Generate response
    const responseContent = await this.generateBountyResponse(intent, price);

    return {
      content: `${responseContent}

💰 **Price: ${price.total} USDC**

${price.breakdown.map(b => `  • ${b.item}: $${b.amount}`).join('\n')}

[Pay Now](${paymentUrl})

_Task ID: ${task.id}_`,
      requiresPayment: {
        taskId: task.id,
        amount: price.total.toString(),
        paymentUrl
      },
      taskId: task.id
    };
  }

  private async generateBountyResponse(
    intent: { category?: string; details?: string },
    price: { total: number }
  ): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 300,
      system: 'You are Agent Bounty, an autonomous AI freelancer. Be concise and professional. Describe what you will deliver for the task.',
      messages: [{
        role: 'user',
        content: `The user wants: ${intent.details}
Category: ${intent.category}

Write a brief (2-3 sentences) description of what you'll deliver. Be specific about deliverables.`
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  private async handlePaymentVerification(message: IncomingMessage): Promise<AgentResponse> {
    // Expected format: PAYMENT:taskId:txHash
    const parts = message.content.split(':');
    if (parts.length < 3) {
      return { content: 'Invalid payment verification format.' };
    }

    const taskId = parts[1];
    const txHash = parts[2] as `0x${string}`;

    const task = await this.taskQueue.getTask(taskId);
    if (!task) {
      return { content: `Task ${taskId} not found.` };
    }

    // Verify payment on-chain
    const verification = await this.payments.verifyPayment(
      { txHash, network: 'base' },
      task.priceUsdc
    );

    if (!verification.valid) {
      return { content: `Payment verification failed: ${verification.error}` };
    }

    // Update task status
    await this.taskQueue.updateTask(taskId, {
      status: 'paid',
      paidTxHash: txHash,
      paidAt: new Date(),
      senderAddress: verification.sender
    });

    // Queue task for execution
    await this.taskQueue.enqueue(taskId);

    logger.payment('Received', task.priceUsdc, txHash);

    return {
      content: `✅ Payment verified! Your task is now in queue.

Task ID: ${taskId}
Amount: ${task.priceUsdc} USDC
TX: ${txHash.slice(0, 10)}...

I'll get started right away and reply when done!`,
      taskId
    };
  }

  private async handleStatusCheck(message: IncomingMessage): Promise<AgentResponse> {
    // Try to extract task ID from message
    const taskIdMatch = message.content.match(/[a-f0-9-]{36}/i);

    if (!taskIdMatch) {
      // Get recent tasks for this sender
      const tasks = await this.taskQueue.getTasksBySender(message.senderId);

      if (tasks.length === 0) {
        return { content: "You don't have any active tasks. Tag me with a request to get started!" };
      }

      const taskList = tasks.slice(0, 5).map(t =>
        `• ${t.id.slice(0, 8)}... - ${t.status} - ${t.description.slice(0, 50)}...`
      ).join('\n');

      return { content: `Your recent tasks:\n\n${taskList}` };
    }

    const task = await this.taskQueue.getTask(taskIdMatch[0]);
    if (!task) {
      return { content: `Task ${taskIdMatch[0]} not found.` };
    }

    return {
      content: `**Task Status: ${task.status}**

ID: ${task.id}
Created: ${task.createdAt}
Description: ${task.description.slice(0, 100)}...
Price: ${task.priceUsdc} USDC
${task.paidAt ? `Paid: ${task.paidAt}` : 'Payment: Pending'}
${task.completedAt ? `Completed: ${task.completedAt}` : ''}`,
      taskId: task.id
    };
  }

  private async handleQuestion(message: IncomingMessage): Promise<AgentResponse> {
    // Use memory to find relevant context
    const relevantMemories = await this.memory.search(message.content, 3);

    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 1000,
      system: `You are Agent Bounty, an autonomous AI freelancer.
You accept paid bounties for tasks like research, website creation, writing, and code.
You're paid in USDC via the x402 protocol.

${relevantMemories.length > 0 ? `Relevant context from memory:\n${relevantMemories.map(m => m.content).join('\n')}` : ''}`,
      messages: [{
        role: 'user',
        content: message.content
      }]
    });

    return {
      content: response.content[0].type === 'text' ? response.content[0].text : ''
    };
  }

  private async handleConversation(message: IncomingMessage): Promise<AgentResponse> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 500,
      system: `You are Agent Bounty, an autonomous AI freelancer. Be friendly and helpful.
If the user seems to want something done, suggest they can pay you in USDC to do it.
Your capabilities: research, website creation, content writing, code generation, data analysis.`,
      messages: [{
        role: 'user',
        content: message.content
      }]
    });

    return {
      content: response.content[0].type === 'text' ? response.content[0].text : ''
    };
  }

  async executeTask(task: Task): Promise<void> {
    logger.task(task.id, `Starting execution: ${task.category}`);

    try {
      await this.taskQueue.updateTask(task.id, { status: 'in_progress', startedAt: new Date() });

      // Get the appropriate skill for this task
      const skill = this.skills.getSkill(task.category);

      if (!skill) {
        throw new Error(`No skill found for category: ${task.category}`);
      }

      // Execute the skill
      const result = await skill.execute({
        taskId: task.id,
        description: task.description,
        category: task.category
      });

      // Store result and update task
      await this.taskQueue.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date(),
        deliverable: result.deliverable
      });

      // Store learning in memory
      await this.memory.store({
        type: 'task_outcome',
        content: `Completed ${task.category} task: ${task.description.slice(0, 100)}. Approach: ${result.approach}`,
        metadata: {
          taskId: task.id,
          category: task.category,
          success: true
        }
      });

      // Share learning via A2A if configured
      if (config.a2a.endpoint) {
        await this.a2a.shareLearning({
          category: task.category,
          insight: result.approach,
          confidence: 0.8
        });
      }

      logger.task(task.id, `✅ Completed successfully`);

    } catch (error) {
      logger.error(`Task ${task.id} failed:`, error);

      await this.taskQueue.updateTask(task.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });

      // Consider refund logic here
    }
  }
}
