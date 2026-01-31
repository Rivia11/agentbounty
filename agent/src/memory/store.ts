import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface Memory {
  id: string;
  type: 'task_outcome' | 'user_preference' | 'skill_learning' | 'a2a_insight';
  content: string;
  embedding?: number[];
  metadata: {
    source?: string;
    category?: string;
    taskId?: string;
    confidence?: number;
    success?: boolean;
  };
  createdAt: Date;
}

export interface MemorySearchResult {
  memory: Memory;
  score: number;
}

export class MemoryStore {
  private redis: Redis | null = null;
  private anthropic: Anthropic;
  private useInMemory = false;
  private inMemoryStore: Map<string, Memory> = new Map();
  private inMemoryByType: Map<string, Set<string>> = new Map();
  private inMemoryCreated: Array<{ id: string; timestamp: number }> = [];

  constructor(redisUrl: string) {
    this.anthropic = new Anthropic({ apiKey: config.ai.apiKey });

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn('Redis connection failed, using in-memory storage');
            this.useInMemory = true;
            return null; // Stop retrying
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true
      });

      this.redis.on('error', () => {
        if (!this.useInMemory) {
          logger.warn('Redis error, falling back to in-memory storage');
          this.useInMemory = true;
        }
      });
    } catch {
      logger.warn('Could not create Redis client, using in-memory storage');
      this.useInMemory = true;
    }
  }

  async connect(): Promise<void> {
    if (this.useInMemory || !this.redis) {
      this.useInMemory = true;
      logger.info('Using in-memory storage (Redis not available)');
      return;
    }

    try {
      await this.redis.connect();
      await this.redis.ping();
      logger.info('Connected to Redis');
    } catch {
      logger.warn('Could not connect to Redis, using in-memory storage');
      this.useInMemory = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis && !this.useInMemory) {
      await this.redis.quit();
    }
  }

  async store(data: {
    type: Memory['type'];
    content: string;
    metadata?: Memory['metadata'];
  }): Promise<Memory> {
    const memory: Memory = {
      id: randomUUID(),
      type: data.type,
      content: data.content,
      metadata: data.metadata || {},
      createdAt: new Date()
    };

    // Generate embedding for semantic search
    memory.embedding = await this.generateEmbedding(data.content);

    if (this.useInMemory) {
      // Store in memory
      this.inMemoryStore.set(memory.id, memory);

      // Index by type
      if (!this.inMemoryByType.has(memory.type)) {
        this.inMemoryByType.set(memory.type, new Set());
      }
      this.inMemoryByType.get(memory.type)!.add(memory.id);

      // Track creation order
      this.inMemoryCreated.push({ id: memory.id, timestamp: Date.now() });
    } else if (this.redis) {
      // Store in Redis
      await this.redis.hset(`memory:${memory.id}`, {
        id: memory.id,
        type: memory.type,
        content: memory.content,
        embedding: JSON.stringify(memory.embedding),
        metadata: JSON.stringify(memory.metadata),
        createdAt: memory.createdAt.toISOString()
      });

      // Index by type
      await this.redis.sadd(`memories:type:${memory.type}`, memory.id);
      await this.redis.zadd('memories:created', Date.now(), memory.id);
    }

    logger.debug(`Stored memory: ${memory.id} (${memory.type})`);

    return memory;
  }

  async search(query: string, limit = 5): Promise<Memory[]> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    if (this.useInMemory) {
      const results: MemorySearchResult[] = [];

      for (const memory of this.inMemoryStore.values()) {
        if (!memory.embedding) continue;
        const score = this.cosineSimilarity(queryEmbedding, memory.embedding);
        if (score > 0.7) {
          results.push({ memory, score });
        }
      }

      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(r => r.memory);
    }

    if (!this.redis) return [];

    // Get all memory IDs
    const memoryIds = await this.redis.zrevrange('memories:created', 0, 100);

    const results: MemorySearchResult[] = [];

    for (const id of memoryIds) {
      const data = await this.redis.hgetall(`memory:${id}`);
      if (!data || !data.embedding) continue;

      const embedding = JSON.parse(data.embedding) as number[];
      const score = this.cosineSimilarity(queryEmbedding, embedding);

      if (score > 0.7) {
        results.push({
          memory: {
            id: data.id,
            type: data.type as Memory['type'],
            content: data.content,
            embedding,
            metadata: JSON.parse(data.metadata || '{}'),
            createdAt: new Date(data.createdAt)
          },
          score
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.memory);
  }

  async getByType(type: Memory['type'], limit = 20): Promise<Memory[]> {
    if (this.useInMemory) {
      const ids = this.inMemoryByType.get(type);
      if (!ids) return [];

      const memories: Memory[] = [];
      for (const id of Array.from(ids).slice(0, limit)) {
        const memory = this.inMemoryStore.get(id);
        if (memory) memories.push(memory);
      }
      return memories;
    }

    if (!this.redis) return [];

    const memoryIds = await this.redis.smembers(`memories:type:${type}`);
    const memories: Memory[] = [];

    for (const id of memoryIds.slice(0, limit)) {
      const data = await this.redis.hgetall(`memory:${id}`);
      if (!data) continue;

      memories.push({
        id: data.id,
        type: data.type as Memory['type'],
        content: data.content,
        metadata: JSON.parse(data.metadata || '{}'),
        createdAt: new Date(data.createdAt)
      });
    }

    return memories;
  }

  async getRecent(limit = 10): Promise<Memory[]> {
    if (this.useInMemory) {
      return this.inMemoryCreated
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit)
        .map(item => this.inMemoryStore.get(item.id)!)
        .filter(Boolean);
    }

    if (!this.redis) return [];

    const memoryIds = await this.redis.zrevrange('memories:created', 0, limit - 1);
    const memories: Memory[] = [];

    for (const id of memoryIds) {
      const data = await this.redis.hgetall(`memory:${id}`);
      if (!data) continue;

      memories.push({
        id: data.id,
        type: data.type as Memory['type'],
        content: data.content,
        metadata: JSON.parse(data.metadata || '{}'),
        createdAt: new Date(data.createdAt)
      });
    }

    return memories;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Simplified embedding using Claude to generate a semantic hash
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        system: 'Generate a semantic summary of the text in exactly 10 keywords separated by commas. Just the keywords, nothing else.',
        messages: [{ role: 'user', content: text }]
      });

      const keywords = response.content[0].type === 'text'
        ? response.content[0].text.split(',').map(k => k.trim().toLowerCase())
        : [];

      return this.keywordsToEmbedding(keywords);
    } catch {
      // Fallback to simple hash
      return this.keywordsToEmbedding(text.toLowerCase().split(/\s+/).slice(0, 10));
    }
  }

  private keywordsToEmbedding(keywords: string[]): number[] {
    const embedding = new Array(128).fill(0);

    for (const keyword of keywords) {
      const hash = this.simpleHash(keyword);
      for (let i = 0; i < 8; i++) {
        const index = (hash + i * 17) % 128;
        embedding[index] += 1 / (i + 1);
      }
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
