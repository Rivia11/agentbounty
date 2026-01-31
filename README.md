# 🦞 Agent Bounty

An autonomous AI agent that accepts bounties, communicates with other agents, and operates its own micro-economy.

## Features

- **x402 Payments** - Accept USDC payments on Base via HTTP 402
- **Multi-Channel** - Twitter/X, Telegram, Discord, Web
- **A2A Protocol** - Communicate and learn from other agents
- **Skills** - Research, websites, writing, code generation
- **Polymarket Trading** - Trade on prediction markets (optional)
- **Token Economy** - Launch and manage your own token (optional)

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm
- Docker (for Redis)

### Local Development

```bash
# Clone and install
git clone <your-repo>
cd agent-bounty
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Generate wallet
pnpm exec tsx scripts/generate-wallet.ts

# Start Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Start agent
pnpm agent:dev

# In another terminal, start frontend
pnpm web:dev
```

### Production Deployment

```bash
# On your server (Ubuntu 24.04 recommended)
./scripts/deploy.sh
```

## Configuration

Edit `.env` with your credentials:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
AGENT_WALLET_PRIVATE_KEY=0x...

# Optional channels
TWITTER_USERNAME=...
TWITTER_PASSWORD=...
TELEGRAM_BOT_TOKEN=...

# Optional services
EXA_API_KEY=...        # For research
VERCEL_TOKEN=...       # For website deployment
POLYMARKET_API_KEY=... # For trading
```

## Architecture

```
agent-bounty/
├── agent/               # Core agent
│   ├── src/
│   │   ├── index.ts     # Entry point
│   │   ├── core.ts      # Agent logic
│   │   ├── payments/    # x402 handling
│   │   ├── channels/    # Twitter, Telegram, Web
│   │   ├── skills/      # Research, Website, etc.
│   │   └── a2a/         # Agent-to-agent
│   └── Dockerfile
│
├── web/                 # Next.js frontend
│   └── app/
│       ├── page.tsx     # Landing
│       ├── gigs/        # Gig catalog
│       └── agent/       # Agent profile
│
├── docker-compose.yml
└── SPEC.md              # Full specification
```

## How It Works

1. **User requests task** via Twitter, Telegram, or Web
2. **Agent analyzes** and returns price quote
3. **User pays** via x402 (USDC on Base)
4. **Agent verifies** payment on-chain
5. **Agent executes** task using skills
6. **Agent delivers** result to user

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /agent` | Agent info & stats |
| `POST /message` | Send message to agent |
| `POST /payment/verify` | Verify x402 payment |
| `GET /task/:id` | Get task status |
| `GET /gigs` | List available gigs |

## Skills

| Skill | Description | Price |
|-------|-------------|-------|
| Research | Deep research with sources | $5+ |
| Website | Landing page + deployment | $25+ |
| Writing | Blog, threads, docs | $5+ |
| Code | Generate, review, debug | $10+ |

## Security

- Run behind Tailscale for secure access
- Never expose wallet private key
- Use read-only API tokens where possible
- Financial limits enforced in code

## License

MIT

## Links

- [x402 Protocol](https://x402.org)
- [A2A Protocol](https://a2a-protocol.org)
- [Base](https://base.org)
- [Anthropic Claude](https://anthropic.com)
