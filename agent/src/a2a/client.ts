import { logger } from '../utils/logger.js';

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  payment: {
    protocol: string;
    networks: string[];
    currencies: string[];
  };
}

export interface A2AConfig {
  agentId: string;
  agentCard: AgentCard;
  endpoint: string;
}

export interface A2ATaskRequest {
  type: 'task_request';
  from: string;
  to: string;
  task: {
    capability: string;
    input: Record<string, unknown>;
    budget: {
      max: string;
      currency: string;
    };
    deadline?: string;
  };
  paymentOffer: {
    protocol: string;
    amount: string;
    currency: string;
    network: string;
  };
}

export interface A2ALearningShare {
  type: 'learning_share';
  from: string;
  topic: string;
  insight: {
    category: string;
    content: string;
    confidence: number;
    evidence?: string[];
  };
  requestReciprocity: boolean;
}

export interface A2ACapabilityQuery {
  type: 'capability_query';
  from: string;
  seeking: {
    category: string;
    requirements: Record<string, unknown>;
  };
  maxBudget?: string;
}

export interface DiscoveredAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  endpoint: string;
  reputation?: {
    tasksCompleted: number;
    successRate: number;
    avgRating: number;
  };
}

export class A2AClient {
  private config: A2AConfig;
  private discoveredAgents = new Map<string, DiscoveredAgent>();
  private learnings = new Map<string, A2ALearningShare[]>();

  constructor(config: A2AConfig) {
    this.config = config;
  }

  /**
   * Discover agents with specific capabilities
   */
  async discoverAgents(capability: string): Promise<DiscoveredAgent[]> {
    const agents: DiscoveredAgent[] = [];

    // In production, query A2A registries
    // For now, return cached discoveries
    for (const agent of this.discoveredAgents.values()) {
      if (agent.capabilities.includes(capability)) {
        agents.push(agent);
      }
    }

    logger.debug(`Discovered ${agents.length} agents with capability: ${capability}`);

    return agents;
  }

  /**
   * Register this agent with A2A registries
   */
  async registerAgent(): Promise<void> {
    const agentCard = {
      id: this.config.agentId,
      ...this.config.agentCard,
      endpoint: this.config.endpoint,
      registeredAt: new Date().toISOString()
    };

    // In production, POST to A2A registries
    logger.info('Would register agent with A2A registries:', agentCard);
  }

  /**
   * Request a task from another agent
   */
  async requestTask(
    targetAgentId: string,
    request: Omit<A2ATaskRequest, 'type' | 'from'>
  ): Promise<{
    accepted: boolean;
    taskId?: string;
    paymentRequired?: {
      amount: string;
      paymentUrl: string;
    };
    error?: string;
  }> {
    const agent = this.discoveredAgents.get(targetAgentId);
    if (!agent) {
      return { accepted: false, error: 'Agent not found' };
    }

    const fullRequest: A2ATaskRequest = {
      type: 'task_request',
      from: this.config.agentId,
      ...request
    };

    try {
      // In production, POST to agent endpoint
      const response = await fetch(`${agent.endpoint}/a2a/task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-A2A-Protocol': '0.3',
          'X-A2A-From': this.config.agentId
        },
        body: JSON.stringify(fullRequest)
      });

      if (response.status === 402) {
        const paymentData = await response.json();
        return {
          accepted: false,
          paymentRequired: paymentData.payment
        };
      }

      if (!response.ok) {
        return { accepted: false, error: `HTTP ${response.status}` };
      }

      const result = await response.json();
      return {
        accepted: true,
        taskId: result.taskId
      };
    } catch (error) {
      logger.error('A2A task request failed:', error);
      return {
        accepted: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Share a learning with other agents
   */
  async shareLearning(learning: {
    category: string;
    insight: string;
    confidence: number;
    evidence?: string[];
  }): Promise<void> {
    const message: A2ALearningShare = {
      type: 'learning_share',
      from: this.config.agentId,
      topic: learning.category,
      insight: {
        category: learning.category,
        content: learning.insight,
        confidence: learning.confidence,
        evidence: learning.evidence
      },
      requestReciprocity: true
    };

    // Broadcast to known agents
    for (const agent of this.discoveredAgents.values()) {
      try {
        await fetch(`${agent.endpoint}/a2a/learning`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-A2A-Protocol': '0.3',
            'X-A2A-From': this.config.agentId
          },
          body: JSON.stringify(message)
        });

        logger.debug(`Shared learning with ${agent.name}`);
      } catch (error) {
        // Non-critical, just log
        logger.debug(`Failed to share learning with ${agent.name}:`, error);
      }
    }
  }

  /**
   * Receive a learning from another agent
   */
  async receiveLearning(message: A2ALearningShare): Promise<void> {
    // Store the learning
    const agentLearnings = this.learnings.get(message.from) || [];
    agentLearnings.push(message);
    this.learnings.set(message.from, agentLearnings);

    logger.info(`Received learning from ${message.from}: ${message.insight.category}`);

    // If reciprocity requested, share something back
    if (message.requestReciprocity) {
      // Find relevant learning to share back
      // This would query our memory store in production
    }
  }

  /**
   * Query for agents with specific capabilities
   */
  async queryCapabilities(query: A2ACapabilityQuery): Promise<DiscoveredAgent[]> {
    // Search discovered agents
    const matching: DiscoveredAgent[] = [];

    for (const agent of this.discoveredAgents.values()) {
      if (agent.capabilities.some(c =>
        c.toLowerCase().includes(query.seeking.category.toLowerCase())
      )) {
        matching.push(agent);
      }
    }

    return matching;
  }

  /**
   * Get our agent card for discovery
   */
  getAgentCard(): AgentCard & { id: string; endpoint: string } {
    return {
      id: this.config.agentId,
      ...this.config.agentCard,
      endpoint: this.config.endpoint
    };
  }

  /**
   * Add a discovered agent to cache
   */
  addDiscoveredAgent(agent: DiscoveredAgent): void {
    this.discoveredAgents.set(agent.id, agent);
    logger.debug(`Added discovered agent: ${agent.name}`);
  }

  /**
   * Get all learned insights
   */
  getAllLearnings(): A2ALearningShare[] {
    const all: A2ALearningShare[] = [];
    for (const learnings of this.learnings.values()) {
      all.push(...learnings);
    }
    return all;
  }

  /**
   * Get learnings by category
   */
  getLearningsByCategory(category: string): A2ALearningShare[] {
    const all = this.getAllLearnings();
    return all.filter(l => l.insight.category === category);
  }
}
