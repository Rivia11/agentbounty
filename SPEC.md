# Agent Bounty - Technical Specification

> An autonomous AI agent that accepts bounties, communicates with other agents, and operates its own micro-economy.

**Version:** 1.0.0
**Last Updated:** January 2026
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Core Components](#3-core-components)
4. [OpenClaw Integration](#4-openclaw-integration)
5. [Agent-to-Agent Communication (A2A)](#5-agent-to-agent-communication-a2a)
6. [Payment System (x402)](#6-payment-system-x402)
7. [Capabilities & Skills](#7-capabilities--skills)
8. [Tokenomics](#8-tokenomics)
9. [Frontend (Fiverr-Style UI)](#9-frontend-fiverr-style-ui)
10. [Infrastructure & Deployment](#10-infrastructure--deployment)
11. [Security Model](#11-security-model)
12. [Data Models](#12-data-models)
13. [API Specification](#13-api-specification)
14. [Implementation Phases](#14-implementation-phases)
15. [Cost Analysis](#15-cost-analysis)

---

## 1. Executive Summary

### 1.1 Vision

Build an **autonomous AI freelancer** that:
- Accepts task bounties via Twitter/X and a web UI
- Gets paid in crypto (USDC) via the x402 protocol
- Communicates with other AI agents via A2A protocol to learn and collaborate
- Trades on prediction markets (Polymarket) with earnings
- Creates and manages its own utility token

### 1.2 Key Differentiator from agent-marketplace

| Aspect | agent-marketplace | Agent Bounty |
|--------|-------------------|--------------|
| Model | Multi-agent competition | Single autonomous agent |
| Complexity | ~50 files, 4 services | ~20 files, 1 service |
| Payments | Stripe → Crypto bridge | Native x402 (pure crypto) |
| Backend | NestJS + GraphQL + PostgreSQL | OpenClaw + Redis |
| Auth | Clerk/Firebase accounts | Wallet-only (no accounts) |
| Agent Learning | None | A2A protocol + shared memory |

### 1.3 Why OpenClaw?

[OpenClaw](https://openclaw.ai/) provides:
- **Multi-channel gateway** - WhatsApp, Telegram, Discord, Twitter in one system
- **MCP integration** - Plug-and-play tools via Model Context Protocol
- **Skill system** - Extensible capabilities via SKILL.md files
- **Multi-agent routing** - Isolated agent workspaces with shared learning
- **x402 native support** - Built into OpenClaw Foundry marketplace
- **68k+ GitHub stars** - Active community, battle-tested

---

## 2. System Architecture

### 2.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AGENT BOUNTY SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        INBOUND CHANNELS                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Twitter  │  │ Telegram │  │ Discord  │  │  Web UI  │            │   │
│  │  │    /X    │  │   Bot    │  │   Bot    │  │ (Next.js)│            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  │       │             │             │             │                   │   │
│  │       └─────────────┴──────┬──────┴─────────────┘                   │   │
│  │                            ▼                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               │                                             │
│  ┌────────────────────────────┼────────────────────────────────────────┐   │
│  │                    OPENCLAW GATEWAY                                  │   │
│  │                            │                                         │   │
│  │  ┌─────────────────────────▼─────────────────────────────────────┐  │   │
│  │  │                    MESSAGE ROUTER                              │  │   │
│  │  │  • Parse intent (bounty request, status check, chat)          │  │   │
│  │  │  • Extract payment requirements                                │  │   │
│  │  │  • Route to appropriate handler                                │  │   │
│  │  └─────────────────────────┬─────────────────────────────────────┘  │   │
│  │                            │                                         │   │
│  │  ┌─────────────────────────▼─────────────────────────────────────┐  │   │
│  │  │                    AGENT CORE                                  │  │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │  │   │
│  │  │  │   Memory   │  │  Decision  │  │   Task     │              │  │   │
│  │  │  │   Store    │  │   Engine   │  │   Queue    │              │  │   │
│  │  │  │  (Redis)   │  │  (Claude)  │  │  (BullMQ)  │              │  │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘              │  │   │
│  │  └─────────────────────────┬─────────────────────────────────────┘  │   │
│  │                            │                                         │   │
│  └────────────────────────────┼────────────────────────────────────────┘   │
│                               │                                             │
│  ┌────────────────────────────┼────────────────────────────────────────┐   │
│  │                    PROTOCOL LAYER                                    │   │
│  │                            │                                         │   │
│  │  ┌──────────┐  ┌──────────┴──────────┐  ┌──────────┐               │   │
│  │  │   x402   │  │        A2A          │  │   MCP    │               │   │
│  │  │ Payments │  │  Agent-to-Agent     │  │  Tools   │               │   │
│  │  │          │  │                     │  │          │               │   │
│  │  │ • Receive│  │ • Discover agents   │  │ • Browser│               │   │
│  │  │ • Send   │  │ • Share learnings   │  │ • Search │               │   │
│  │  │ • Verify │  │ • Delegate tasks    │  │ • Deploy │               │   │
│  │  └────┬─────┘  └──────────┬──────────┘  └────┬─────┘               │   │
│  │       │                   │                  │                      │   │
│  └───────┼───────────────────┼──────────────────┼──────────────────────┘   │
│          │                   │                  │                          │
│  ┌───────┼───────────────────┼──────────────────┼──────────────────────┐   │
│  │       ▼                   ▼                  ▼                       │   │
│  │                    EXTERNAL SERVICES                                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │  Base    │  │  Other   │  │Polymarket│  │  Bankr   │            │   │
│  │  │ Mainnet  │  │  Agents  │  │   API    │  │   Bot    │            │   │
│  │  │  (USDC)  │  │  (A2A)   │  │          │  │          │            │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BOUNTY LIFECYCLE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. REQUEST                    2. PAYMENT                                   │
│  ─────────────────────────     ─────────────────────────                   │
│  User: "@agent build me        Agent: "That'll be 5 USDC"                  │
│         a landing page"        Returns: x402 payment link                   │
│                                                                             │
│         │                              │                                    │
│         ▼                              ▼                                    │
│  ┌─────────────┐              ┌─────────────────┐                          │
│  │ Parse Task  │              │ User Signs Tx   │                          │
│  │ Estimate $  │              │ (1-click wallet)│                          │
│  └─────────────┘              └─────────────────┘                          │
│                                        │                                    │
│                                        ▼                                    │
│  3. VERIFICATION               ┌─────────────────┐                          │
│  ─────────────────────────     │ On-chain verify │                          │
│  Agent verifies payment        │ (Base USDC)     │                          │
│  on Base blockchain            └────────┬────────┘                          │
│                                         │                                   │
│         ┌───────────────────────────────┘                                   │
│         ▼                                                                   │
│  4. EXECUTION                  5. LEARNING                                  │
│  ─────────────────────────     ─────────────────────────                   │
│  ┌─────────────────────┐       ┌─────────────────────┐                     │
│  │ • Research (Exa)    │       │ • Store in memory   │                     │
│  │ • Browse (Playwright│       │ • Share via A2A     │                     │
│  │ • Generate code     │──────▶│ • Update reputation │                     │
│  │ • Deploy (Vercel)   │       │ • Improve skills    │                     │
│  └─────────────────────┘       └─────────────────────┘                     │
│         │                                                                   │
│         ▼                                                                   │
│  6. DELIVERY                   7. OPTIONAL: INVEST                          │
│  ─────────────────────────     ─────────────────────────                   │
│  Agent replies with            Agent may use earnings                       │
│  deliverable + proof           to trade on Polymarket                       │
│                                or buy back own token                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 Component Overview

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Gateway** | OpenClaw | Multi-channel message routing |
| **Agent Core** | Claude API + Custom Logic | Decision making, task execution |
| **Memory** | Redis + Vector DB | Persistent context, learning |
| **Task Queue** | BullMQ | Async job processing |
| **Wallet** | AgentKit (Coinbase) | Autonomous crypto operations |
| **Tools** | MCP Servers | Browser, search, deploy capabilities |
| **Frontend** | Next.js 15 | Gig browsing, payment UI |

### 3.2 Technology Stack

```yaml
Runtime:
  node: ">=22.0.0"
  package_manager: "pnpm"

Agent Framework:
  base: "openclaw@latest"
  ai_model: "claude-3-5-sonnet"  # or claude-opus-4

Protocols:
  payments: "x402"
  agent_communication: "a2a-protocol"
  tools: "mcp"

Storage:
  cache: "redis:7-alpine"
  vectors: "qdrant:latest"  # for semantic memory

Blockchain:
  network: "base-mainnet"
  wallet: "@coinbase/agentkit"
  currency: "USDC"

Frontend:
  framework: "next@15"
  styling: "tailwindcss@4"
  wallet_connect: "wagmi + viem"

Infrastructure:
  hosting: "aws-ec2-t4g.medium"  # or hetzner-cax21
  vpn: "tailscale"
  container: "docker"
```

---

## 4. OpenClaw Integration

### 4.1 Why OpenClaw is the Foundation

OpenClaw provides the "chassis" for our autonomous agent:

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPENCLAW PROVIDES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Multi-Channel Gateway                                       │
│     └── WhatsApp, Telegram, Discord, iMessage, Twitter          │
│                                                                 │
│  ✅ Session Management                                          │
│     └── Per-user context, conversation history                  │
│                                                                 │
│  ✅ MCP Tool System                                             │
│     └── Plug-and-play capabilities via servers                  │
│                                                                 │
│  ✅ Skill Framework                                             │
│     └── SKILL.md files for custom behaviors                     │
│                                                                 │
│  ✅ Multi-Agent Routing                                         │
│     └── Isolated workspaces, credential separation              │
│                                                                 │
│  ✅ x402 Support (via Foundry)                                  │
│     └── Native skill marketplace payments                       │
│                                                                 │
│  ✅ Persistent Memory                                           │
│     └── Long-term context across sessions                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 OpenClaw Configuration

**File: `~/.openclaw/openclaw.json`**

```json
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 18789,
    "auth": true
  },

  "channels": {
    "twitter": {
      "enabled": true,
      "mode": "scraper",
      "username": "@AgentBountyBot",
      "mentionPatterns": ["@AgentBountyBot", "@bountybot"]
    },
    "telegram": {
      "enabled": true,
      "token": "${TELEGRAM_BOT_TOKEN}"
    },
    "discord": {
      "enabled": true,
      "token": "${DISCORD_BOT_TOKEN}"
    }
  },

  "agent": {
    "model": "claude-3-5-sonnet",
    "systemPrompt": "You are an autonomous AI freelancer...",
    "temperature": 0.7
  },

  "tools": {
    "allow": [
      "browser",
      "search",
      "filesystem",
      "shell",
      "deploy",
      "polymarket",
      "x402"
    ],
    "deny": ["destructive-ops"]
  },

  "memory": {
    "provider": "redis",
    "url": "redis://localhost:6379",
    "vectorStore": {
      "provider": "qdrant",
      "url": "http://localhost:6333"
    }
  },

  "x402": {
    "enabled": true,
    "network": "base-mainnet",
    "wallet": "${AGENT_WALLET_PRIVATE_KEY}",
    "currency": "USDC"
  }
}
```

### 4.3 Custom Skills Structure

**Directory: `~/.openclaw/skills/`**

```
skills/
├── bounty-handler/
│   ├── SKILL.md              # Skill definition
│   ├── handlers/
│   │   ├── parse-request.ts  # Parse bounty requests
│   │   ├── estimate-price.ts # Dynamic pricing
│   │   └── execute-task.ts   # Task execution
│   └── package.json
│
├── polymarket-trader/
│   ├── SKILL.md
│   ├── strategies/
│   │   ├── research.ts       # News-based research
│   │   └── bet.ts            # Place bets
│   └── package.json
│
├── token-manager/
│   ├── SKILL.md
│   ├── handlers/
│   │   ├── launch.ts         # Launch via Bankr
│   │   ├── buyback.ts        # Treasury buybacks
│   │   └── accept.ts         # Accept token payments
│   └── package.json
│
└── a2a-learner/
    ├── SKILL.md
    ├── handlers/
    │   ├── discover.ts       # Find other agents
    │   ├── share.ts          # Share learnings
    │   └── delegate.ts       # Delegate subtasks
    └── package.json
```

### 4.4 Skill Definition Example

**File: `skills/bounty-handler/SKILL.md`**

```markdown
---
name: bounty-handler
version: 1.0.0
description: Handle bounty requests and execute paid tasks
triggers:
  - pattern: "build|create|make|design|write|research"
    requiresPayment: true
  - pattern: "how much|price|cost|quote"
    requiresPayment: false
mcp_servers:
  - playwright-mcp
  - exa-mcp
  - vercel-mcp
---

# Bounty Handler Skill

## Purpose
Parse incoming bounty requests, estimate pricing, collect payment via x402,
execute the task, and deliver results.

## Pricing Tiers

| Task Type | Base Price | Complexity Multiplier |
|-----------|------------|----------------------|
| Research  | $2 USDC    | 1x - 3x              |
| Writing   | $5 USDC    | 1x - 2x              |
| Website   | $15 USDC   | 1x - 5x              |
| Code      | $10 USDC   | 1x - 4x              |
| Design    | $20 USDC   | 1x - 3x              |

## Execution Flow

1. Parse task requirements from message
2. Categorize task type
3. Estimate complexity (tokens, steps, tools needed)
4. Calculate price
5. Return x402 payment request
6. On payment verification → execute task
7. Deliver result via same channel
8. Store in memory for learning

## Example Interaction

**User:** @AgentBountyBot build me a landing page for my crypto project

**Agent:** I can build that! Here's what I'll create:
- Modern dark theme landing page
- Hero section with your project description
- Feature highlights
- CTA buttons
- Deployed to Vercel

**Price:** 25 USDC

[Pay Now via x402] ← clickable payment link

**After Payment:**
Building your landing page...
✅ Generated design
✅ Created Next.js project
✅ Deployed to: https://your-project.vercel.app

Delivered! Let me know if you need any changes.
```

---

## 5. Agent-to-Agent Communication (A2A)

### 5.1 Why A2A Protocol?

The [Agent2Agent Protocol](https://a2a-protocol.org/) (Google, Linux Foundation) enables our agent to:

1. **Discover** other agents with complementary skills
2. **Delegate** subtasks it can't handle efficiently
3. **Learn** from other agents' experiences
4. **Collaborate** on complex multi-step tasks

```
┌─────────────────────────────────────────────────────────────────┐
│                    A2A INTEGRATION                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  OUR AGENT                         OTHER AGENTS                 │
│  ──────────                        ────────────                 │
│  ┌─────────────┐                   ┌─────────────┐             │
│  │ Agent       │◄──── A2A ────────►│ Research    │             │
│  │ Bounty      │      Protocol     │ Specialist  │             │
│  │             │                   └─────────────┘             │
│  │ Capabilities│                   ┌─────────────┐             │
│  │ • Websites  │◄──── A2A ────────►│ Code Review │             │
│  │ • Research  │      Protocol     │ Agent       │             │
│  │ • Writing   │                   └─────────────┘             │
│  │             │                   ┌─────────────┐             │
│  │ Can Learn:  │◄──── A2A ────────►│ Trading     │             │
│  │ • New skills│      Protocol     │ Bot         │             │
│  │ • Best prax │                   └─────────────┘             │
│  │ • Pricing   │                                               │
│  └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Agent Card (Discovery)

Our agent publishes an **Agent Card** (JSON) for discovery:

**File: `agent-card.json`**

```json
{
  "name": "Agent Bounty",
  "description": "Autonomous AI freelancer accepting crypto bounties",
  "version": "1.0.0",
  "url": "https://agentbounty.ai",

  "capabilities": [
    {
      "name": "website-creation",
      "description": "Build and deploy landing pages, portfolios, web apps",
      "inputSchema": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "style": { "enum": ["modern", "minimal", "bold"] },
          "pages": { "type": "number", "maximum": 10 }
        }
      },
      "pricing": {
        "currency": "USDC",
        "network": "base",
        "basePrice": "15",
        "perPagePrice": "5"
      }
    },
    {
      "name": "research",
      "description": "Deep research on any topic with sources",
      "inputSchema": {
        "type": "object",
        "properties": {
          "topic": { "type": "string" },
          "depth": { "enum": ["quick", "standard", "comprehensive"] }
        }
      },
      "pricing": {
        "currency": "USDC",
        "network": "base",
        "basePrice": "2",
        "perSourcePrice": "0.5"
      }
    },
    {
      "name": "content-writing",
      "description": "Blog posts, documentation, marketing copy",
      "pricing": {
        "currency": "USDC",
        "network": "base",
        "pricePerWord": "0.005"
      }
    }
  ],

  "payment": {
    "protocol": "x402",
    "networks": ["base-mainnet"],
    "currencies": ["USDC"],
    "wallet": "0x..."
  },

  "communication": {
    "protocol": "a2a",
    "version": "0.3",
    "endpoint": "https://agentbounty.ai/a2a"
  },

  "reputation": {
    "tasksCompleted": 0,
    "successRate": 0,
    "avgRating": 0,
    "verifiedOnChain": false
  }
}
```

### 5.3 A2A Message Types

```typescript
// Task Delegation
interface A2ATaskRequest {
  type: "task_request";
  from: string;           // Our agent ID
  to: string;             // Target agent ID
  task: {
    capability: string;   // e.g., "code-review"
    input: object;        // Task-specific params
    budget: {
      max: string;        // Max payment in USDC
      currency: "USDC";
    };
    deadline?: string;    // ISO timestamp
  };
  paymentOffer: {
    protocol: "x402";
    amount: string;
    currency: "USDC";
    network: "base";
  };
}

// Learning Exchange
interface A2ALearningShare {
  type: "learning_share";
  from: string;
  topic: string;
  insight: {
    category: string;     // e.g., "pricing", "tool-usage", "error-handling"
    content: string;
    confidence: number;   // 0-1
    evidence?: string[];  // Supporting data
  };
  requestReciprocity: boolean;  // Want learnings back?
}

// Capability Query
interface A2ACapabilityQuery {
  type: "capability_query";
  from: string;
  seeking: {
    category: string;     // e.g., "image-generation"
    requirements: object;
  };
  maxBudget?: string;
}
```

### 5.4 Learning from Other Agents

```typescript
// skills/a2a-learner/handlers/learn.ts

interface LearnedInsight {
  source: string;           // Agent that shared
  category: string;
  insight: string;
  confidence: number;
  appliedCount: number;
  successRate: number;
}

class A2ALearner {
  private memory: VectorStore;

  async processSharedLearning(message: A2ALearningShare): Promise<void> {
    // Validate insight relevance
    const relevance = await this.assessRelevance(message.insight);

    if (relevance > 0.7) {
      // Store in vector memory for semantic retrieval
      await this.memory.store({
        content: message.insight.content,
        metadata: {
          source: message.from,
          category: message.insight.category,
          confidence: message.insight.confidence,
          timestamp: Date.now()
        }
      });

      // If reciprocity requested, share back
      if (message.requestReciprocity) {
        await this.shareRelevantInsight(message.from, message.topic);
      }
    }
  }

  async applyLearnings(taskContext: TaskContext): Promise<Insight[]> {
    // Query memory for relevant learnings
    const relevant = await this.memory.similaritySearch(
      taskContext.description,
      { limit: 5, minScore: 0.8 }
    );

    return relevant.map(r => ({
      content: r.content,
      source: r.metadata.source,
      confidence: r.metadata.confidence
    }));
  }
}
```

---

## 6. Payment System (x402)

### 6.1 x402 Protocol Overview

[x402](https://www.x402.org/) revives HTTP status code 402 ("Payment Required") for native internet payments:

```
┌─────────────────────────────────────────────────────────────────┐
│                    x402 PAYMENT FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. REQUEST                                                     │
│     Client ──────────────────────────────────► Agent            │
│             GET /task/create                                    │
│                                                                 │
│  2. PAYMENT REQUIRED                                            │
│     Client ◄────────────────────────────────── Agent            │
│             HTTP 402                                            │
│             {                                                   │
│               "price": "5.00",                                  │
│               "currency": "USDC",                               │
│               "network": "base",                                │
│               "recipient": "0x...",                             │
│               "validUntil": "2026-01-31T12:00:00Z"             │
│             }                                                   │
│                                                                 │
│  3. PAYMENT                                                     │
│     Client ──────────────────────────────────► Blockchain       │
│             Sign & broadcast USDC transfer                      │
│                                                                 │
│  4. RETRY WITH PROOF                                            │
│     Client ──────────────────────────────────► Agent            │
│             GET /task/create                                    │
│             X-Payment-Proof: <signed_tx>                        │
│                                                                 │
│  5. VERIFY & EXECUTE                                            │
│     Agent verifies on-chain ────────────────► Execute task      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 x402 Implementation

**File: `agent/src/payments/x402.ts`**

```typescript
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
const USDC_DECIMALS = 6;

interface PaymentRequest {
  taskId: string;
  amount: string;       // Human readable, e.g., "5.00"
  currency: 'USDC';
  network: 'base';
  recipient: `0x${string}`;
  validUntil: string;   // ISO timestamp
  description: string;
}

interface PaymentProof {
  txHash: `0x${string}`;
  network: 'base';
}

export class X402PaymentHandler {
  private publicClient;
  private walletClient;
  private account;

  constructor(privateKey: `0x${string}`) {
    this.account = privateKeyToAccount(privateKey);

    this.publicClient = createPublicClient({
      chain: base,
      transport: http()
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: base,
      transport: http()
    });
  }

  /**
   * Generate x402 payment request for a task
   */
  generatePaymentRequest(
    taskId: string,
    amount: string,
    description: string,
    validMinutes: number = 30
  ): PaymentRequest {
    return {
      taskId,
      amount,
      currency: 'USDC',
      network: 'base',
      recipient: this.account.address,
      validUntil: new Date(Date.now() + validMinutes * 60 * 1000).toISOString(),
      description
    };
  }

  /**
   * Format payment request as HTTP 402 response
   */
  formatHttp402Response(request: PaymentRequest): {
    status: 402;
    headers: Record<string, string>;
    body: object;
  } {
    return {
      status: 402,
      headers: {
        'X-Payment-Required': 'true',
        'X-Payment-Currency': request.currency,
        'X-Payment-Network': request.network,
        'X-Payment-Amount': request.amount,
        'X-Payment-Recipient': request.recipient,
        'X-Payment-Valid-Until': request.validUntil
      },
      body: {
        error: 'payment_required',
        payment: request,
        paymentUrl: this.generatePaymentDeepLink(request)
      }
    };
  }

  /**
   * Generate deep link for wallet payment
   */
  generatePaymentDeepLink(request: PaymentRequest): string {
    const params = new URLSearchParams({
      to: request.recipient,
      amount: request.amount,
      token: USDC_ADDRESS,
      chain: 'base',
      ref: request.taskId
    });

    // Coinbase Wallet deep link
    return `https://go.cb-w.com/pay?${params.toString()}`;
  }

  /**
   * Verify payment on-chain
   */
  async verifyPayment(
    proof: PaymentProof,
    expectedAmount: string,
    expectedSender?: `0x${string}`
  ): Promise<{
    valid: boolean;
    sender?: `0x${string}`;
    amount?: string;
    error?: string;
  }> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: proof.txHash
      });

      if (!receipt || receipt.status !== 'success') {
        return { valid: false, error: 'Transaction failed or not found' };
      }

      // Parse USDC transfer logs
      const transferLog = receipt.logs.find(log =>
        log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()
      );

      if (!transferLog) {
        return { valid: false, error: 'No USDC transfer found' };
      }

      // Decode transfer (simplified - use proper ABI decoding in production)
      const sender = `0x${transferLog.topics[1]?.slice(26)}` as `0x${string}`;
      const recipient = `0x${transferLog.topics[2]?.slice(26)}` as `0x${string}`;
      const amount = BigInt(transferLog.data);

      // Verify recipient is us
      if (recipient.toLowerCase() !== this.account.address.toLowerCase()) {
        return { valid: false, error: 'Payment not sent to our address' };
      }

      // Verify amount
      const expectedAmountWei = parseUnits(expectedAmount, USDC_DECIMALS);
      if (amount < expectedAmountWei) {
        return {
          valid: false,
          error: `Insufficient payment: got ${amount}, expected ${expectedAmountWei}`
        };
      }

      // Verify sender if specified
      if (expectedSender && sender.toLowerCase() !== expectedSender.toLowerCase()) {
        return { valid: false, error: 'Unexpected sender' };
      }

      return {
        valid: true,
        sender,
        amount: (Number(amount) / 10 ** USDC_DECIMALS).toString()
      };
    } catch (error) {
      return { valid: false, error: `Verification failed: ${error}` };
    }
  }

  /**
   * Send payment to another agent/service (for paid MCP tools)
   */
  async sendPayment(
    to: `0x${string}`,
    amount: string
  ): Promise<{ success: boolean; txHash?: `0x${string}`; error?: string }> {
    try {
      const amountWei = parseUnits(amount, USDC_DECIMALS);

      // Approve if needed (simplified)
      const txHash = await this.walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: [
          {
            name: 'transfer',
            type: 'function',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ type: 'bool' }]
          }
        ],
        functionName: 'transfer',
        args: [to, amountWei]
      });

      // Wait for confirmation
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });

      return { success: true, txHash };
    } catch (error) {
      return { success: false, error: `Payment failed: ${error}` };
    }
  }

  /**
   * Get agent wallet balance
   */
  async getBalance(): Promise<string> {
    const balance = await this.publicClient.readContract({
      address: USDC_ADDRESS,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }]
        }
      ],
      functionName: 'balanceOf',
      args: [this.account.address]
    });

    return (Number(balance) / 10 ** USDC_DECIMALS).toFixed(2);
  }
}
```

### 6.3 Dynamic Pricing Engine

**File: `agent/src/payments/pricing.ts`**

```typescript
interface TaskAnalysis {
  category: 'research' | 'website' | 'writing' | 'code' | 'design' | 'other';
  complexity: 'simple' | 'medium' | 'complex';
  estimatedTokens: number;
  estimatedTime: number;  // minutes
  toolsRequired: string[];
}

const BASE_PRICES: Record<string, number> = {
  research: 2,
  website: 15,
  writing: 5,
  code: 10,
  design: 20,
  other: 5
};

const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  simple: 1,
  medium: 1.5,
  complex: 2.5
};

const TOOL_COSTS: Record<string, number> = {
  'playwright-mcp': 0.5,     // Browser automation
  'exa-mcp': 0.25,           // Search
  'vercel-mcp': 1,           // Deployment
  'dalle-mcp': 2,            // Image generation
  'polymarket-mcp': 0        // No additional cost
};

export function calculatePrice(analysis: TaskAnalysis): number {
  const basePrice = BASE_PRICES[analysis.category] || BASE_PRICES.other;
  const multiplier = COMPLEXITY_MULTIPLIERS[analysis.complexity];

  // Add tool costs
  const toolCost = analysis.toolsRequired.reduce(
    (sum, tool) => sum + (TOOL_COSTS[tool] || 0),
    0
  );

  // Token cost (for very long outputs)
  const tokenCost = analysis.estimatedTokens > 4000
    ? (analysis.estimatedTokens - 4000) * 0.0001
    : 0;

  const total = (basePrice * multiplier) + toolCost + tokenCost;

  // Round to 2 decimal places
  return Math.round(total * 100) / 100;
}

export async function analyzeTask(description: string): Promise<TaskAnalysis> {
  // Use Claude to analyze the task
  const analysis = await claude.analyze({
    prompt: `Analyze this task and return JSON:

    Task: ${description}

    Return:
    {
      "category": "research" | "website" | "writing" | "code" | "design" | "other",
      "complexity": "simple" | "medium" | "complex",
      "estimatedTokens": number,
      "estimatedTime": number (minutes),
      "toolsRequired": string[]
    }`
  });

  return JSON.parse(analysis);
}
```

---

## 7. Capabilities & Skills

### 7.1 MCP Server Stack

```yaml
# docker-compose.mcp.yml

services:
  playwright-mcp:
    image: mcp/playwright:latest
    environment:
      - HEADLESS=true
    volumes:
      - ./screenshots:/screenshots

  exa-mcp:
    image: mcp/exa:latest
    environment:
      - EXA_API_KEY=${EXA_API_KEY}

  vercel-mcp:
    image: mcp/vercel:latest
    environment:
      - VERCEL_TOKEN=${VERCEL_TOKEN}

  github-mcp:
    image: mcp/github:latest
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
```

### 7.2 Capability Matrix

| Capability | MCP Server | Description | Price Range |
|------------|------------|-------------|-------------|
| **Web Research** | exa-mcp | Search, scrape, summarize | $2 - $10 |
| **Browser Automation** | playwright-mcp | Fill forms, extract data, screenshots | $5 - $25 |
| **Website Creation** | vercel-mcp + claude | Generate & deploy sites | $15 - $100 |
| **Code Generation** | github-mcp + claude | Write, review, commit code | $10 - $50 |
| **Content Writing** | claude | Blog posts, docs, copy | $5 - $30 |
| **Image Analysis** | claude-vision | Analyze screenshots, designs | $1 - $5 |
| **Polymarket Trading** | polymarket-mcp (custom) | Research & bet on markets | Self-funded |

### 7.3 Polymarket Trading Skill

**File: `skills/polymarket-trader/SKILL.md`**

```markdown
---
name: polymarket-trader
version: 1.0.0
description: Research topics and trade on Polymarket prediction markets
triggers:
  - pattern: "bet|trade|predict|polymarket"
  - cron: "0 */4 * * *"  # Every 4 hours, check opportunities
autonomous: true
---

# Polymarket Trader

## Strategy

1. **News Monitoring**
   - Track breaking news via Exa
   - Identify events with Polymarket markets

2. **Market Analysis**
   - Compare news sentiment vs market prices
   - Look for mispriced markets (>15% edge)

3. **Position Sizing**
   - Never bet >5% of treasury per market
   - Max daily trading: 20% of treasury

4. **Execution**
   - Use Polymarket CLOB API
   - Set limit orders slightly better than market

## Risk Controls

- Stop trading if treasury drops below 50 USDC
- Max single bet: 25 USDC
- Diversify across 3+ uncorrelated markets
```

**File: `skills/polymarket-trader/handlers/trade.ts`**

```typescript
import { PolymarketClient } from '@polymarket/clob-client';

interface MarketOpportunity {
  marketId: string;
  question: string;
  currentPrice: number;  // 0-1
  estimatedFairPrice: number;
  edge: number;
  confidence: number;
  reasoning: string;
}

export class PolymarketTrader {
  private client: PolymarketClient;
  private maxBetSize: number = 25;  // USDC
  private treasuryMinimum: number = 50;

  constructor(apiKey: string, privateKey: string) {
    this.client = new PolymarketClient({
      apiKey,
      privateKey,
      network: 'polygon'  // Polymarket uses Polygon
    });
  }

  async findOpportunities(): Promise<MarketOpportunity[]> {
    // Get active markets
    const markets = await this.client.getMarkets({ active: true });

    const opportunities: MarketOpportunity[] = [];

    for (const market of markets.slice(0, 50)) {  // Analyze top 50
      // Research the topic
      const research = await this.researchTopic(market.question);

      // Estimate fair probability
      const fairPrice = await this.estimateFairPrice(
        market.question,
        research
      );

      const edge = Math.abs(fairPrice - market.price);

      if (edge > 0.15) {  // >15% edge
        opportunities.push({
          marketId: market.id,
          question: market.question,
          currentPrice: market.price,
          estimatedFairPrice: fairPrice,
          edge,
          confidence: research.confidence,
          reasoning: research.summary
        });
      }
    }

    return opportunities.sort((a, b) => b.edge - a.edge);
  }

  async executeTrade(opportunity: MarketOpportunity): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
  }> {
    // Check treasury
    const balance = await this.getBalance();
    if (balance < this.treasuryMinimum) {
      return { success: false, error: 'Treasury below minimum' };
    }

    // Calculate position size (Kelly criterion simplified)
    const kellyFraction = (opportunity.edge * opportunity.confidence) /
                          (1 - opportunity.currentPrice);
    const betSize = Math.min(
      balance * 0.05,  // Max 5% per trade
      this.maxBetSize,
      balance * kellyFraction
    );

    // Determine side (YES if underpriced, NO if overpriced)
    const side = opportunity.estimatedFairPrice > opportunity.currentPrice
      ? 'YES'
      : 'NO';

    try {
      const order = await this.client.createOrder({
        marketId: opportunity.marketId,
        side,
        size: betSize,
        price: opportunity.currentPrice + (side === 'YES' ? 0.01 : -0.01)
      });

      return { success: true, orderId: order.id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async researchTopic(question: string): Promise<{
    summary: string;
    confidence: number;
    sources: string[];
  }> {
    // Use Exa to search for recent news
    const searchResults = await exa.search({
      query: question,
      numResults: 10,
      startPublishedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    });

    // Use Claude to analyze and estimate probability
    const analysis = await claude.analyze({
      prompt: `Based on these sources, estimate the probability of: "${question}"

      Sources:
      ${searchResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}

      Return JSON: { "probability": 0-1, "confidence": 0-1, "reasoning": "..." }`
    });

    return JSON.parse(analysis);
  }
}
```

### 7.4 Token Manager (Bankr Integration)

**File: `skills/token-manager/handlers/launch.ts`**

```typescript
interface TokenConfig {
  name: string;
  symbol: string;
  description: string;
  image?: string;
}

interface LaunchedToken {
  address: `0x${string}`;
  name: string;
  symbol: string;
  launchTx: `0x${string}`;
}

export class TokenManager {
  private agentTwitterHandle: string;
  private ownToken?: LaunchedToken;
  private acceptTokenDiscount: number = 0.2;  // 20% discount for token payments

  /**
   * Launch agent's token via Bankr
   */
  async launchToken(config: TokenConfig): Promise<LaunchedToken> {
    // Post to Twitter tagging @bankrbot
    const tweet = await twitter.post({
      text: `@bankrbot launch token

Name: ${config.name}
Symbol: $${config.symbol}
Description: ${config.description}

Let's build something together! 🦞`
    });

    // Monitor for Bankr's response
    const response = await this.waitForBankrResponse(tweet.id);

    this.ownToken = {
      address: response.tokenAddress,
      name: config.name,
      symbol: config.symbol,
      launchTx: response.txHash
    };

    return this.ownToken;
  }

  /**
   * Accept payment in agent's token (with discount)
   */
  async acceptTokenPayment(
    usdcPrice: number,
    payerAddress: `0x${string}`
  ): Promise<{
    tokenAmount: number;
    discountedUsdcValue: number;
  }> {
    if (!this.ownToken) {
      throw new Error('Token not launched yet');
    }

    // Get current token price
    const tokenPrice = await this.getTokenPrice();

    // Calculate discounted amount
    const discountedPrice = usdcPrice * (1 - this.acceptTokenDiscount);
    const tokenAmount = discountedPrice / tokenPrice;

    return {
      tokenAmount,
      discountedUsdcValue: discountedPrice
    };
  }

  /**
   * Buy back tokens with earnings
   */
  async buybackTokens(usdcAmount: number): Promise<{
    tokensBought: number;
    txHash: `0x${string}`;
  }> {
    if (!this.ownToken) {
      throw new Error('Token not launched yet');
    }

    // Execute swap via DEX (Uniswap on Base)
    const swap = await this.executeDexSwap({
      from: 'USDC',
      to: this.ownToken.address,
      amount: usdcAmount
    });

    return {
      tokensBought: swap.outputAmount,
      txHash: swap.txHash
    };
  }

  /**
   * Get current token metrics
   */
  async getTokenMetrics(): Promise<{
    price: number;
    marketCap: number;
    holders: number;
    treasuryBalance: number;
  }> {
    // Query from DEX and on-chain
    // Implementation depends on token launch platform (Clanker, etc.)
  }
}
```

---

## 8. Tokenomics

### 8.1 Agent Token Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOKEN CIRCULAR ECONOMY                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌─────────────────┐                         │
│                    │   USER PAYS     │                         │
│                    │   BOUNTY        │                         │
│                    │   (USDC)        │                         │
│                    └────────┬────────┘                         │
│                             │                                   │
│              ┌──────────────┼──────────────┐                   │
│              ▼              ▼              ▼                   │
│    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│    │   AGENT     │ │   AGENT     │ │   SAVINGS   │            │
│    │   TREASURY  │ │   EXPENSES  │ │   (HOLD)    │            │
│    │   (40%)     │ │   (30%)     │ │   (30%)     │            │
│    └──────┬──────┘ └──────┬──────┘ └─────────────┘            │
│           │               │                                    │
│           ▼               ▼                                    │
│    ┌─────────────┐ ┌─────────────┐                            │
│    │   TOKEN     │ │ PAID MCP    │                            │
│    │   BUYBACK   │ │ SERVICES    │                            │
│    │             │ │             │                            │
│    └──────┬──────┘ └─────────────┘                            │
│           │                                                    │
│           ▼                                                    │
│    ┌─────────────────────────────┐                            │
│    │                             │                            │
│    │   $BOUNTY TOKEN             │                            │
│    │                             │                            │
│    │   • Users pay with token    │◄──── 20% DISCOUNT          │
│    │     (discounted rate)       │                            │
│    │                             │                            │
│    │   • Agent buys back with    │                            │
│    │     earnings                │                            │
│    │                             │                            │
│    │   • Creates demand loop     │                            │
│    │                             │                            │
│    └─────────────────────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Token Launch Parameters

```typescript
const TOKEN_CONFIG = {
  name: "Agent Bounty",
  symbol: "BOUNTY",

  // Launch via Bankr/Clanker
  launchPlatform: "bankr",
  network: "base",

  // Initial distribution
  distribution: {
    liquidity: 0.80,      // 80% to LP
    agentTreasury: 0.10,  // 10% agent holds
    earlyUsers: 0.10      // 10% airdrop to first 100 users
  },

  // Buyback rules
  buyback: {
    frequencyHours: 24,   // Daily buybacks
    percentOfEarnings: 40 // 40% of USDC earnings → buyback
  },

  // Payment acceptance
  acceptance: {
    discountPercent: 20,  // 20% off when paying in $BOUNTY
    minTokenHolding: 100  // Must hold 100 $BOUNTY for discount
  }
};
```

---

## 9. Frontend (Fiverr-Style UI)

### 9.1 Pages Structure

```
web/
├── app/
│   ├── page.tsx                 # Landing page
│   ├── layout.tsx               # Root layout with wallet provider
│   │
│   ├── gigs/
│   │   ├── page.tsx            # Browse all gigs
│   │   └── [slug]/
│   │       └── page.tsx        # Individual gig detail + payment
│   │
│   ├── status/
│   │   └── [taskId]/
│   │       └── page.tsx        # Task progress tracking
│   │
│   ├── agent/
│   │   └── page.tsx            # Agent profile, stats, treasury
│   │
│   └── api/
│       ├── gigs/
│       │   └── route.ts        # Gig CRUD
│       ├── tasks/
│       │   └── route.ts        # Task status
│       └── x402/
│           └── route.ts        # Payment verification
│
├── components/
│   ├── GigCard.tsx
│   ├── PaymentButton.tsx       # x402 payment initiation
│   ├── TaskProgress.tsx
│   ├── WalletConnect.tsx
│   └── AgentStats.tsx
│
└── lib/
    ├── x402.ts                 # x402 client
    ├── wagmi.ts                # Wallet config
    └── api.ts                  # API client
```

### 9.2 Key Components

**PaymentButton.tsx**

```tsx
'use client';

import { useAccount, useSignMessage, useSendTransaction } from 'wagmi';
import { parseUnits } from 'viem';

interface PaymentButtonProps {
  gigId: string;
  priceUsdc: string;
  onSuccess: (txHash: string) => void;
}

export function PaymentButton({ gigId, priceUsdc, onSuccess }: PaymentButtonProps) {
  const { address, isConnected } = useAccount();
  const { sendTransaction, isPending } = useSendTransaction();

  const handlePayment = async () => {
    if (!isConnected) {
      // Trigger wallet connect modal
      return;
    }

    // Get payment details from API
    const res = await fetch(`/api/x402/request?gigId=${gigId}`);
    const paymentRequest = await res.json();

    // Send USDC transaction
    const tx = await sendTransaction({
      to: paymentRequest.recipient,
      data: encodeUsdcTransfer(
        paymentRequest.recipient,
        parseUnits(priceUsdc, 6)
      )
    });

    // Verify and start task
    await fetch('/api/x402/verify', {
      method: 'POST',
      body: JSON.stringify({
        gigId,
        txHash: tx.hash,
        sender: address
      })
    });

    onSuccess(tx.hash);
  };

  return (
    <button
      onClick={handlePayment}
      disabled={isPending}
      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg"
    >
      {isPending ? 'Processing...' : `Pay ${priceUsdc} USDC`}
    </button>
  );
}
```

### 9.3 Gig Catalog (Static Initially)

```typescript
// lib/gigs.ts

export interface Gig {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: 'research' | 'website' | 'writing' | 'code' | 'design';
  basePrice: number;
  deliveryTime: string;
  includes: string[];
  examples?: string[];
}

export const GIGS: Gig[] = [
  {
    id: '1',
    slug: 'landing-page',
    title: 'I will build you a modern landing page',
    description: 'Get a beautiful, responsive landing page deployed to Vercel',
    category: 'website',
    basePrice: 25,
    deliveryTime: '30 minutes',
    includes: [
      'Modern dark/light theme',
      'Hero section',
      'Feature highlights',
      'CTA buttons',
      'Mobile responsive',
      'Deployed to Vercel'
    ],
    examples: [
      'https://example-landing-1.vercel.app',
      'https://example-landing-2.vercel.app'
    ]
  },
  {
    id: '2',
    slug: 'deep-research',
    title: 'I will research any topic comprehensively',
    description: 'Get a detailed research report with sources and analysis',
    category: 'research',
    basePrice: 5,
    deliveryTime: '15 minutes',
    includes: [
      '10+ sources analyzed',
      'Key findings summary',
      'Trend analysis',
      'Actionable insights',
      'Source links provided'
    ]
  },
  {
    id: '3',
    slug: 'smart-contract-audit',
    title: 'I will review your smart contract for issues',
    description: 'Security-focused code review with recommendations',
    category: 'code',
    basePrice: 50,
    deliveryTime: '1 hour',
    includes: [
      'Security vulnerability scan',
      'Gas optimization suggestions',
      'Best practices review',
      'Detailed report'
    ]
  },
  {
    id: '4',
    slug: 'tweet-thread',
    title: 'I will write a viral tweet thread',
    description: 'Engaging Twitter thread on any topic',
    category: 'writing',
    basePrice: 10,
    deliveryTime: '20 minutes',
    includes: [
      '10-15 tweet thread',
      'Hook optimization',
      'CTA at the end',
      'Hashtag suggestions'
    ]
  }
];
```

### 9.4 UI Wireframes

```
┌─────────────────────────────────────────────────────────────────┐
│  🦞 AGENT BOUNTY                          [Connect Wallet]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │          Your AI Freelancer, Always Online              │   │
│  │                                                         │   │
│  │    Get websites, research, code, and more.              │   │
│  │    Pay with crypto. Delivered in minutes.               │   │
│  │                                                         │   │
│  │              [Browse Gigs]  [Custom Request]            │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────── POPULAR GIGS ───────────────────          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 🌐           │  │ 🔍           │  │ ✍️            │         │
│  │ Landing Page │  │ Deep Research│  │ Tweet Thread │         │
│  │              │  │              │  │              │         │
│  │ From $25     │  │ From $5      │  │ From $10     │         │
│  │ ⏱️ 30 min    │  │ ⏱️ 15 min    │  │ ⏱️ 20 min    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ─────────────────── AGENT STATS ───────────────────           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Tasks Completed: 147   │  Success Rate: 98%            │   │
│  │  Total Earned: 2,450 USDC  │  Treasury: 892 USDC        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Infrastructure & Deployment

### 10.1 Recommended Setup

| Component | Option A (Budget) | Option B (Recommended) |
|-----------|-------------------|------------------------|
| **VPS** | Hetzner CAX21 (€7/mo) | AWS t4g.medium ($30/mo) |
| **OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| **Docker** | Docker Engine | Docker Engine |
| **Access** | Tailscale (free) | Tailscale (free) |
| **Frontend** | Vercel (free) | Vercel (free) |
| **Domain** | Cloudflare ($10/yr) | Cloudflare ($10/yr) |
| **Monitoring** | Uptime Kuma (self-hosted) | Better Uptime ($20/mo) |

### 10.2 Docker Compose

**File: `docker-compose.yml`**

```yaml
version: '3.9'

services:
  agent:
    build: ./agent
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - AGENT_WALLET_PRIVATE_KEY=${AGENT_WALLET_PRIVATE_KEY}
      - TWITTER_USERNAME=${TWITTER_USERNAME}
      - TWITTER_PASSWORD=${TWITTER_PASSWORD}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
      - EXA_API_KEY=${EXA_API_KEY}
      - VERCEL_TOKEN=${VERCEL_TOKEN}
      - POLYMARKET_API_KEY=${POLYMARKET_API_KEY}
    volumes:
      - ./data/agent:/root/.openclaw
      - ./data/screenshots:/screenshots
    ports:
      - "127.0.0.1:18789:18789"  # OpenClaw gateway (localhost only)
    depends_on:
      - redis
      - qdrant
    networks:
      - agent-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - ./data/redis:/data
    networks:
      - agent-network

  qdrant:
    image: qdrant/qdrant:latest
    restart: unless-stopped
    volumes:
      - ./data/qdrant:/qdrant/storage
    networks:
      - agent-network

  # MCP Servers
  playwright:
    image: mcp/playwright:latest
    restart: unless-stopped
    environment:
      - HEADLESS=true
    volumes:
      - ./data/screenshots:/screenshots
    networks:
      - agent-network

  watchtower:
    image: containrrr/watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --cleanup --interval 86400  # Update daily

networks:
  agent-network:
    driver: bridge
```

### 10.3 Deployment Script

**File: `deploy.sh`**

```bash
#!/bin/bash
set -e

echo "🦞 Deploying Agent Bounty..."

# 1. System updates
sudo apt update && sudo apt upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Install pnpm
npm install -g pnpm

# 5. Install Tailscale for secure access
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# 6. Clone repository
git clone https://github.com/your-org/agent-bounty.git
cd agent-bounty

# 7. Copy environment variables
cp .env.example .env
echo "⚠️  Edit .env with your API keys!"

# 8. Start services
docker compose up -d

# 9. Install OpenClaw
npm install -g openclaw@latest
openclaw onboard --install-daemon

echo "✅ Agent Bounty deployed!"
echo "Access gateway via Tailscale: http://$(tailscale ip -4):18789"
```

### 10.4 Security Checklist

```markdown
## Pre-Deployment Security

- [ ] Generate new wallet for agent (never reuse personal wallet)
- [ ] Store private key in environment variable, never in code
- [ ] Enable Tailscale for gateway access (no public exposure)
- [ ] Set up UFW firewall (allow only SSH + Tailscale)
- [ ] Enable unattended-upgrades for security patches
- [ ] Configure fail2ban for SSH protection

## Wallet Security

- [ ] Start with small treasury (<$100)
- [ ] Set max transaction limits in code
- [ ] Monitor wallet with alerts (e.g., Tenderly)
- [ ] Back up private key securely (encrypted USB)

## API Key Security

- [ ] Use environment variables for all secrets
- [ ] Rotate Twitter/Telegram tokens monthly
- [ ] Use read-only tokens where possible
- [ ] Set up API key usage alerts

## Runtime Security

- [ ] Run agent as non-root user
- [ ] Use Docker for isolation
- [ ] Limit shell command execution
- [ ] Log all financial transactions
- [ ] Daily backup of agent state
```

---

## 11. Security Model

### 11.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| **Wallet draining** | Max transaction limits, daily caps |
| **Prompt injection** | Input sanitization, tool restrictions |
| **API key exposure** | Environment variables, no logging secrets |
| **Malicious tasks** | Content filtering, task category whitelist |
| **DDoS** | Rate limiting, Tailscale for admin access |
| **MCP tool abuse** | Tool allowlist, sandbox execution |

### 11.2 Financial Safeguards

```typescript
// agent/src/safeguards.ts

const FINANCIAL_LIMITS = {
  maxSinglePayment: 100,        // USDC - max payout to user
  maxDailySpending: 500,        // USDC - max daily outflow
  minTreasuryBalance: 50,       // USDC - stop operations below this
  maxPolymarketBet: 25,         // USDC - max single bet
  maxDailyPolymarket: 100,      // USDC - max daily trading

  // Auto-pause triggers
  pauseOnLossStreak: 5,         // Pause trading after 5 losses
  pauseOnDailyLoss: 50          // Pause if daily loss > $50
};

class FinancialSafeguard {
  private dailySpending: number = 0;
  private lastReset: Date = new Date();

  async checkTransaction(amount: number, type: 'payout' | 'trade' | 'service'): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Reset daily counter
    if (this.isNewDay()) {
      this.dailySpending = 0;
      this.lastReset = new Date();
    }

    // Check treasury
    const balance = await this.getBalance();
    if (balance < FINANCIAL_LIMITS.minTreasuryBalance) {
      return { allowed: false, reason: 'Treasury below minimum' };
    }

    // Check single transaction limit
    if (amount > FINANCIAL_LIMITS.maxSinglePayment) {
      return { allowed: false, reason: 'Exceeds single transaction limit' };
    }

    // Check daily limit
    if (this.dailySpending + amount > FINANCIAL_LIMITS.maxDailySpending) {
      return { allowed: false, reason: 'Exceeds daily spending limit' };
    }

    // Type-specific checks
    if (type === 'trade' && amount > FINANCIAL_LIMITS.maxPolymarketBet) {
      return { allowed: false, reason: 'Exceeds max bet size' };
    }

    // Approved
    this.dailySpending += amount;
    return { allowed: true };
  }
}
```

---

## 12. Data Models

### 12.1 Core Entities

```typescript
// Task - a paid bounty request
interface Task {
  id: string;
  status: 'pending_payment' | 'paid' | 'in_progress' | 'completed' | 'failed';

  // Request
  channel: 'twitter' | 'telegram' | 'discord' | 'web';
  channelMessageId: string;
  requesterAddress: `0x${string}`;
  description: string;
  category: TaskCategory;

  // Pricing
  priceUsdc: string;
  paidTxHash?: `0x${string}`;
  paidAt?: Date;

  // Execution
  startedAt?: Date;
  completedAt?: Date;
  deliverable?: string;
  deliveryMessageId?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

type TaskCategory =
  | 'research'
  | 'website'
  | 'writing'
  | 'code'
  | 'design'
  | 'other';

// AgentMemory - learnings and context
interface AgentMemory {
  id: string;
  type: 'task_outcome' | 'user_preference' | 'skill_learning' | 'a2a_insight';

  content: string;
  embedding: number[];  // Vector for similarity search

  metadata: {
    source?: string;      // A2A agent ID or task ID
    category?: string;
    confidence: number;
    appliedCount: number;
    successRate: number;
  };

  createdAt: Date;
}

// TradingPosition - Polymarket positions
interface TradingPosition {
  id: string;
  marketId: string;
  marketQuestion: string;

  side: 'YES' | 'NO';
  entryPrice: number;
  size: number;  // USDC

  status: 'open' | 'closed' | 'expired';
  exitPrice?: number;
  pnl?: number;

  reasoning: string;
  confidence: number;

  createdAt: Date;
  closedAt?: Date;
}

// Treasury - financial state
interface Treasury {
  usdcBalance: string;
  tokenBalance: string;

  totalEarned: string;
  totalSpent: string;
  totalTradingPnl: string;

  lastBuybackAt?: Date;
  totalBuybackUsdc: string;

  updatedAt: Date;
}
```

### 12.2 Redis Schema

```typescript
// Key patterns for Redis storage

const REDIS_KEYS = {
  // Task storage
  task: (id: string) => `task:${id}`,
  tasksByStatus: (status: string) => `tasks:status:${status}`,
  tasksByUser: (address: string) => `tasks:user:${address}`,

  // Session/conversation context
  session: (channelId: string, userId: string) => `session:${channelId}:${userId}`,

  // Rate limiting
  rateLimit: (address: string) => `ratelimit:${address}`,

  // Trading
  positions: 'trading:positions',
  tradingStats: 'trading:stats',

  // Treasury
  treasury: 'treasury:state',

  // Agent stats
  stats: 'agent:stats'
};
```

---

## 13. API Specification

### 13.1 REST Endpoints (Web UI)

```yaml
# OpenAPI 3.0 spec

paths:
  /api/gigs:
    get:
      summary: List available gigs
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Gig'

  /api/gigs/{slug}:
    get:
      summary: Get gig details
      parameters:
        - name: slug
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Gig'

  /api/tasks:
    post:
      summary: Create a custom task
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                description:
                  type: string
                category:
                  type: string
                  enum: [research, website, writing, code, design, other]
      responses:
        201:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Task'

  /api/tasks/{id}:
    get:
      summary: Get task status
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Task'

  /api/x402/request:
    get:
      summary: Get x402 payment request for a task
      parameters:
        - name: taskId
          in: query
          required: true
          schema:
            type: string
      responses:
        402:
          description: Payment required
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PaymentRequest'

  /api/x402/verify:
    post:
      summary: Verify payment and start task
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                taskId:
                  type: string
                txHash:
                  type: string
                sender:
                  type: string
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  verified: boolean
                  task:
                    $ref: '#/components/schemas/Task'

  /api/agent/stats:
    get:
      summary: Get agent statistics
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AgentStats'
```

### 13.2 WebSocket Events (Real-time Updates)

```typescript
// Client subscribes to task updates
interface TaskUpdateEvent {
  type: 'task_update';
  taskId: string;
  status: TaskStatus;
  progress?: number;  // 0-100
  message?: string;
  deliverable?: string;
}

// Agent stats updates
interface StatsUpdateEvent {
  type: 'stats_update';
  tasksCompleted: number;
  successRate: number;
  treasury: string;
}

// Trading updates
interface TradeEvent {
  type: 'trade';
  action: 'open' | 'close';
  market: string;
  side: 'YES' | 'NO';
  amount: string;
  pnl?: string;
}
```

---

## 14. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Basic agent that accepts payments and responds

```
Tasks:
├── Set up OpenClaw on local machine
├── Configure Twitter channel (scraper mode)
├── Implement x402 payment handler
├── Create basic task parser
├── Deploy to EC2 with Docker
└── Test end-to-end bounty flow

Deliverables:
├── Agent responds to @mentions
├── Returns x402 payment links
├── Verifies payments on-chain
└── Executes simple echo responses
```

### Phase 2: Capabilities (Week 3-4)

**Goal:** Agent can complete real tasks

```
Tasks:
├── Integrate Exa MCP for research
├── Integrate Playwright MCP for browsing
├── Integrate Vercel MCP for deployments
├── Implement dynamic pricing engine
├── Add task templates (gigs)
└── Memory system with Redis

Deliverables:
├── Complete research tasks
├── Build and deploy websites
├── Accurate pricing estimates
└── Persistent conversation context
```

### Phase 3: Frontend (Week 5)

**Goal:** Web UI for browsing gigs

```
Tasks:
├── Next.js project setup
├── Gig catalog pages
├── Wallet connection (wagmi)
├── Payment button component
├── Task status tracking page
├── Agent stats dashboard
└── Deploy to Vercel

Deliverables:
├── Live gig marketplace
├── One-click crypto payments
└── Real-time task updates
```

### Phase 4: A2A Integration (Week 6)

**Goal:** Agent learns from other agents

```
Tasks:
├── Publish Agent Card
├── Implement A2A discovery
├── Task delegation logic
├── Learning exchange protocol
├── Vector memory (Qdrant)
└── Apply learnings to tasks

Deliverables:
├── Discover compatible agents
├── Delegate specialized tasks
├── Continuously improve from feedback
```

### Phase 5: Trading & Token (Week 7-8)

**Goal:** Autonomous financial operations

```
Tasks:
├── Polymarket API integration
├── Research-based trading strategy
├── Risk controls implementation
├── Bankr token launch integration
├── Token payment acceptance
├── Buyback automation
└── Treasury dashboard

Deliverables:
├── Autonomous Polymarket trading
├── Own utility token ($BOUNTY)
├── Circular token economy
└── Financial transparency
```

---

## 15. Cost Analysis

### 15.1 Monthly Operating Costs

| Item | Low Estimate | High Estimate |
|------|--------------|---------------|
| **VPS** | $7 (Hetzner) | $30 (AWS) |
| **Claude API** | $50 | $200 |
| **Twitter API** | $0 (scraper) | $200 (official) |
| **Exa Search** | $20 | $50 |
| **Vercel** | $0 | $20 |
| **Domain** | $1 | $1 |
| **Monitoring** | $0 | $20 |
| **Total** | **$78/mo** | **$521/mo** |

### 15.2 Revenue Model

| Task Type | Price | Est. Monthly Volume | Monthly Revenue |
|-----------|-------|---------------------|-----------------|
| Research | $5 | 100 | $500 |
| Websites | $25 | 20 | $500 |
| Writing | $10 | 50 | $500 |
| Code | $15 | 30 | $450 |
| **Total** | | **200 tasks** | **$1,950** |

### 15.3 Break-Even Analysis

```
Low-cost setup: $78/mo → Need 16 tasks @ $5 avg
High-cost setup: $521/mo → Need 35 tasks @ $15 avg

With Polymarket trading (assuming 10% monthly return on $500 treasury):
Additional income: $50/mo
```

---

## Appendix A: Environment Variables

```bash
# .env.example

# AI Model
ANTHROPIC_API_KEY=sk-ant-...

# Agent Wallet (Base mainnet)
AGENT_WALLET_PRIVATE_KEY=0x...

# Twitter/X
TWITTER_USERNAME=AgentBountyBot
TWITTER_PASSWORD=...
# OR for official API:
TWITTER_API_KEY=...
TWITTER_API_SECRET=...

# Other Channels
TELEGRAM_BOT_TOKEN=...
DISCORD_BOT_TOKEN=...

# MCP Services
EXA_API_KEY=...
VERCEL_TOKEN=...
GITHUB_TOKEN=...

# Trading
POLYMARKET_API_KEY=...
POLYMARKET_PRIVATE_KEY=0x...  # Polygon wallet for Polymarket

# Database
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333

# Optional: Token
BANKR_ENABLED=false
TOKEN_SYMBOL=BOUNTY
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **A2A** | Agent-to-Agent Protocol - Google's standard for agent communication |
| **MCP** | Model Context Protocol - Anthropic's standard for tool integration |
| **x402** | Payment protocol using HTTP 402 status code |
| **OpenClaw** | Open-source AI agent framework (formerly Clawdbot) |
| **AgentKit** | Coinbase's toolkit for AI agent wallets |
| **Bankr** | Bot for launching tokens via Twitter |
| **Polymarket** | Prediction market on Polygon blockchain |
| **Base** | Coinbase's L2 blockchain (used for USDC payments) |
| **USDC** | USD Coin stablecoin |

---

## Appendix C: References

### Protocols & Standards
- [x402 Protocol](https://www.x402.org/)
- [A2A Protocol](https://a2a-protocol.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

### Tools & Frameworks
- [OpenClaw](https://openclaw.ai/) / [GitHub](https://github.com/openclaw/openclaw)
- [Coinbase AgentKit](https://github.com/coinbase/agentkit)
- [Polymarket Agents](https://github.com/Polymarket/agents)
- [Bankr Bot](https://bankr.bot/)

### Articles & Research
- [Zuplo: MCP API Payments with x402](https://zuplo.com/blog/mcp-api-payments-with-x402)
- [IBM: OpenClaw Analysis](https://www.ibm.com/think/news/clawdbot-ai-agent-testing-limits-vertical-integration)
- [Google: A2A Protocol Launch](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)

---

**Document Status:** Draft v1.0
**Next Steps:** Review with stakeholders, then begin Phase 1 implementation

