import { z } from 'zod';

const envSchema = z.object({
  // AI
  ANTHROPIC_API_KEY: z.string().min(1),

  // Wallet
  AGENT_WALLET_PRIVATE_KEY: z.string().startsWith('0x'),
  AGENT_WALLET_ADDRESS: z.string().startsWith('0x').optional(),

  // Twitter
  TWITTER_USERNAME: z.string().optional(),
  TWITTER_PASSWORD: z.string().optional(),
  TWITTER_EMAIL: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // Discord
  DISCORD_BOT_TOKEN: z.string().optional(),

  // MCP Services
  EXA_API_KEY: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),

  // Polymarket
  POLYMARKET_API_KEY: z.string().optional(),
  POLYMARKET_PRIVATE_KEY: z.string().optional(),

  // Database
  REDIS_URL: z.string().default('redis://localhost:6379'),
  QDRANT_URL: z.string().default('http://localhost:6333'),

  // Token
  BANKR_ENABLED: z.string().transform(v => v === 'true').default('false'),
  TOKEN_SYMBOL: z.string().default('BOUNTY'),
  TOKEN_NAME: z.string().default('Agent Bounty'),
  TOKEN_DESCRIPTION: z.string().default('Utility token for Agent Bounty AI freelancer'),

  // Server
  PORT: z.string().transform(Number).default('3001'),
  GATEWAY_PORT: z.string().transform(Number).default('18789'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

const env = envSchema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',

  agent: {
    id: 'agent-bounty-001',
    name: 'Agent Bounty',
    description: 'Autonomous AI freelancer accepting crypto bounties',
    card: {
      name: 'Agent Bounty',
      description: 'Autonomous AI freelancer accepting crypto bounties via x402',
      version: '1.0.0',
      capabilities: [
        'research',
        'website-creation',
        'content-writing',
        'code-generation',
        'data-analysis'
      ],
      payment: {
        protocol: 'x402',
        networks: ['base-mainnet'],
        currencies: ['USDC']
      }
    }
  },

  ai: {
    apiKey: env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096
  },

  wallet: {
    privateKey: env.AGENT_WALLET_PRIVATE_KEY,
    address: env.AGENT_WALLET_ADDRESS
  },

  blockchain: {
    network: 'base' as const,
    rpcUrl: 'https://mainnet.base.org',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
  },

  twitter: {
    enabled: !!(env.TWITTER_USERNAME && env.TWITTER_PASSWORD),
    username: env.TWITTER_USERNAME || '',
    password: env.TWITTER_PASSWORD || '',
    email: env.TWITTER_EMAIL || ''
  },

  telegram: {
    enabled: !!env.TELEGRAM_BOT_TOKEN,
    token: env.TELEGRAM_BOT_TOKEN || ''
  },

  discord: {
    enabled: !!env.DISCORD_BOT_TOKEN,
    token: env.DISCORD_BOT_TOKEN || ''
  },

  mcp: {
    exa: {
      apiKey: env.EXA_API_KEY
    },
    vercel: {
      token: env.VERCEL_TOKEN
    },
    github: {
      token: env.GITHUB_TOKEN
    }
  },

  polymarket: {
    enabled: !!(env.POLYMARKET_API_KEY && env.POLYMARKET_PRIVATE_KEY),
    apiKey: env.POLYMARKET_API_KEY || '',
    privateKey: env.POLYMARKET_PRIVATE_KEY || ''
  },

  redis: {
    url: env.REDIS_URL
  },

  qdrant: {
    url: env.QDRANT_URL
  },

  token: {
    enabled: env.BANKR_ENABLED,
    symbol: env.TOKEN_SYMBOL,
    name: env.TOKEN_NAME,
    description: env.TOKEN_DESCRIPTION
  },

  server: {
    port: env.PORT,
    gatewayPort: env.GATEWAY_PORT
  },

  a2a: {
    endpoint: 'https://agentbounty.ai/a2a',
    discoveryUrls: [
      'https://a2a-registry.io/agents',
      'https://agent-directory.ai/discover'
    ]
  },

  limits: {
    maxSinglePayment: 100,      // USDC
    maxDailySpending: 500,      // USDC
    minTreasuryBalance: 50,     // USDC
    maxPolymarketBet: 25,       // USDC
    maxDailyPolymarket: 100     // USDC
  }
} as const;

export type Config = typeof config;
