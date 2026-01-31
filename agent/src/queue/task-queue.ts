import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

export interface Task {
  id: string;
  status: 'pending_payment' | 'paid' | 'in_progress' | 'completed' | 'failed';
  channel: 'twitter' | 'telegram' | 'discord' | 'web';
  channelMessageId: string;
  senderId: string;
  senderAddress?: `0x${string}`;
  description: string;
  category: string;
  priceUsdc: string;
  paidTxHash?: `0x${string}`;
  paidAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  deliverable?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskUpdate = Partial<Omit<Task, 'id' | 'createdAt'>>;

export class TaskQueue {
  private redis: Redis | null = null;
  private queue: Queue | null = null;
  private worker?: Worker;
  private useInMemory = false;

  // In-memory fallback storage
  private inMemoryTasks: Map<string, Task> = new Map();
  private inMemoryBySender: Map<string, Set<string>> = new Map();
  private inMemoryByStatus: Map<string, Set<string>> = new Map();
  private inMemoryQueue: Array<{ taskId: string; handler?: (task: Task) => Promise<void> }> = [];
  private processingInterval?: NodeJS.Timeout;

  constructor(redisUrl: string) {
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn('Redis connection failed for TaskQueue, using in-memory storage');
            this.useInMemory = true;
            return null;
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true
      });

      this.redis.on('error', () => {
        if (!this.useInMemory) {
          logger.warn('Redis error in TaskQueue, falling back to in-memory');
          this.useInMemory = true;
        }
      });
    } catch {
      logger.warn('Could not create Redis client for TaskQueue, using in-memory');
      this.useInMemory = true;
    }
  }

  async connect(): Promise<void> {
    if (this.useInMemory || !this.redis) {
      this.useInMemory = true;
      logger.info('TaskQueue using in-memory storage (Redis not available)');
      return;
    }

    try {
      await this.redis.connect();
      await this.redis.ping();

      this.queue = new Queue('tasks', {
        connection: this.redis
      });

      logger.info('TaskQueue connected to Redis');
    } catch {
      logger.warn('Could not connect TaskQueue to Redis, using in-memory');
      this.useInMemory = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    if (this.redis && !this.useInMemory) {
      await this.redis.quit();
    }
  }

  async createTask(data: {
    channel: Task['channel'];
    channelMessageId: string;
    senderId: string;
    senderAddress?: `0x${string}`;
    description: string;
    category: string;
    priceUsdc: string;
    status?: Task['status'];
  }): Promise<Task> {
    const task: Task = {
      id: randomUUID(),
      status: data.status || 'pending_payment',
      channel: data.channel,
      channelMessageId: data.channelMessageId,
      senderId: data.senderId,
      senderAddress: data.senderAddress,
      description: data.description,
      category: data.category,
      priceUsdc: data.priceUsdc,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (this.useInMemory) {
      this.inMemoryTasks.set(task.id, task);

      if (!this.inMemoryBySender.has(data.senderId)) {
        this.inMemoryBySender.set(data.senderId, new Set());
      }
      this.inMemoryBySender.get(data.senderId)!.add(task.id);

      if (!this.inMemoryByStatus.has(task.status)) {
        this.inMemoryByStatus.set(task.status, new Set());
      }
      this.inMemoryByStatus.get(task.status)!.add(task.id);
    } else if (this.redis) {
      await this.redis.hset(`task:${task.id}`, this.serializeTask(task));
      await this.redis.sadd(`tasks:sender:${data.senderId}`, task.id);
      await this.redis.sadd(`tasks:status:${task.status}`, task.id);
      await this.redis.zadd('tasks:created', Date.now(), task.id);
    }

    logger.task(task.id, `Created: ${task.category} - ${task.priceUsdc} USDC`);

    return task;
  }

  async getTask(id: string): Promise<Task | null> {
    if (this.useInMemory) {
      return this.inMemoryTasks.get(id) || null;
    }

    if (!this.redis) return null;

    const data = await this.redis.hgetall(`task:${id}`);
    if (!data || Object.keys(data).length === 0) return null;
    return this.deserializeTask(data);
  }

  async updateTask(id: string, update: TaskUpdate): Promise<Task | null> {
    const existing = await this.getTask(id);
    if (!existing) return null;

    const updated: Task = {
      ...existing,
      ...update,
      updatedAt: new Date()
    };

    if (this.useInMemory) {
      // Update status sets if status changed
      if (update.status && update.status !== existing.status) {
        this.inMemoryByStatus.get(existing.status)?.delete(id);
        if (!this.inMemoryByStatus.has(update.status)) {
          this.inMemoryByStatus.set(update.status, new Set());
        }
        this.inMemoryByStatus.get(update.status)!.add(id);
      }
      this.inMemoryTasks.set(id, updated);
    } else if (this.redis) {
      if (update.status && update.status !== existing.status) {
        await this.redis.srem(`tasks:status:${existing.status}`, id);
        await this.redis.sadd(`tasks:status:${update.status}`, id);
      }
      await this.redis.hset(`task:${id}`, this.serializeTask(updated));
    }

    return updated;
  }

  async getTasksBySender(senderId: string, limit = 10): Promise<Task[]> {
    if (this.useInMemory) {
      const taskIds = this.inMemoryBySender.get(senderId);
      if (!taskIds) return [];

      const tasks: Task[] = [];
      for (const id of Array.from(taskIds).slice(0, limit)) {
        const task = this.inMemoryTasks.get(id);
        if (task) tasks.push(task);
      }
      return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    if (!this.redis) return [];

    const taskIds = await this.redis.smembers(`tasks:sender:${senderId}`);
    const tasks: Task[] = [];

    for (const id of taskIds.slice(0, limit)) {
      const task = await this.getTask(id);
      if (task) tasks.push(task);
    }

    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getTasksByStatus(status: Task['status'], limit = 50): Promise<Task[]> {
    if (this.useInMemory) {
      const taskIds = this.inMemoryByStatus.get(status);
      if (!taskIds) return [];

      const tasks: Task[] = [];
      for (const id of Array.from(taskIds).slice(0, limit)) {
        const task = this.inMemoryTasks.get(id);
        if (task) tasks.push(task);
      }
      return tasks;
    }

    if (!this.redis) return [];

    const taskIds = await this.redis.smembers(`tasks:status:${status}`);
    const tasks: Task[] = [];

    for (const id of taskIds.slice(0, limit)) {
      const task = await this.getTask(id);
      if (task) tasks.push(task);
    }

    return tasks;
  }

  async enqueue(taskId: string): Promise<void> {
    if (this.useInMemory) {
      this.inMemoryQueue.push({ taskId });
      logger.task(taskId, 'Enqueued for execution (in-memory)');
      return;
    }

    if (this.queue) {
      await this.queue.add('execute', { taskId }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });
    }

    logger.task(taskId, 'Enqueued for execution');
  }

  startProcessor(handler: (task: Task) => Promise<void>): void {
    if (this.useInMemory) {
      // Simple in-memory processor
      this.processingInterval = setInterval(async () => {
        const item = this.inMemoryQueue.shift();
        if (!item) return;

        const task = await this.getTask(item.taskId);
        if (task) {
          try {
            await handler(task);
            logger.task(item.taskId, 'Processor completed (in-memory)');
          } catch (error) {
            logger.error(`Task ${item.taskId} processor failed:`, error);
          }
        }
      }, 1000);

      logger.info('In-memory task processor started');
      return;
    }

    if (!this.redis) return;

    this.worker = new Worker(
      'tasks',
      async (job: Job) => {
        const task = await this.getTask(job.data.taskId);
        if (!task) {
          throw new Error(`Task ${job.data.taskId} not found`);
        }
        await handler(task);
      },
      {
        connection: this.redis,
        concurrency: 3
      }
    );

    this.worker.on('completed', (job) => {
      logger.task(job.data.taskId, 'Processor completed');
    });

    this.worker.on('failed', (job, error) => {
      logger.error(`Task ${job?.data.taskId} processor failed:`, error);
    });
  }

  async getStats(): Promise<{
    pending: number;
    paid: number;
    inProgress: number;
    completed: number;
    failed: number;
  }> {
    if (this.useInMemory) {
      return {
        pending: this.inMemoryByStatus.get('pending_payment')?.size || 0,
        paid: this.inMemoryByStatus.get('paid')?.size || 0,
        inProgress: this.inMemoryByStatus.get('in_progress')?.size || 0,
        completed: this.inMemoryByStatus.get('completed')?.size || 0,
        failed: this.inMemoryByStatus.get('failed')?.size || 0
      };
    }

    if (!this.redis) {
      return { pending: 0, paid: 0, inProgress: 0, completed: 0, failed: 0 };
    }

    const [pending, paid, inProgress, completed, failed] = await Promise.all([
      this.redis.scard('tasks:status:pending_payment'),
      this.redis.scard('tasks:status:paid'),
      this.redis.scard('tasks:status:in_progress'),
      this.redis.scard('tasks:status:completed'),
      this.redis.scard('tasks:status:failed')
    ]);

    return { pending, paid, inProgress, completed, failed };
  }

  private serializeTask(task: Task): Record<string, string> {
    return {
      id: task.id,
      status: task.status,
      channel: task.channel,
      channelMessageId: task.channelMessageId,
      senderId: task.senderId,
      senderAddress: task.senderAddress || '',
      description: task.description,
      category: task.category,
      priceUsdc: task.priceUsdc,
      paidTxHash: task.paidTxHash || '',
      paidAt: task.paidAt?.toISOString() || '',
      startedAt: task.startedAt?.toISOString() || '',
      completedAt: task.completedAt?.toISOString() || '',
      deliverable: task.deliverable || '',
      error: task.error || '',
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString()
    };
  }

  private deserializeTask(data: Record<string, string>): Task {
    return {
      id: data.id,
      status: data.status as Task['status'],
      channel: data.channel as Task['channel'],
      channelMessageId: data.channelMessageId,
      senderId: data.senderId,
      senderAddress: data.senderAddress ? data.senderAddress as `0x${string}` : undefined,
      description: data.description,
      category: data.category,
      priceUsdc: data.priceUsdc,
      paidTxHash: data.paidTxHash ? data.paidTxHash as `0x${string}` : undefined,
      paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      deliverable: data.deliverable || undefined,
      error: data.error || undefined,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }
}
