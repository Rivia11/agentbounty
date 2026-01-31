#!/bin/bash
set -e

echo "🦞 Agent Bounty Local Development Setup"
echo "========================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() {
  echo -e "${GREEN}➤ $1${NC}"
}

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 22 ]; then
  echo "❌ Node.js 22+ is required. Current version: $(node -v 2>/dev/null || echo 'not installed')"
  echo "   Install with: https://nodejs.org/"
  exit 1
fi

print_step "Node.js $(node -v) detected"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  print_step "Installing pnpm..."
  npm install -g pnpm
fi

# Install dependencies
print_step "Installing dependencies..."
pnpm install

# Setup environment
if [ ! -f .env ]; then
  print_step "Creating .env file..."
  cp .env.example .env
  echo ""
  echo -e "${YELLOW}⚠️  Edit .env with your API keys before running${NC}"
  echo ""
fi

# Generate wallet if needed
if ! grep -q "AGENT_WALLET_PRIVATE_KEY=0x[a-fA-F0-9]" .env 2>/dev/null; then
  print_step "Generating agent wallet..."
  pnpm exec tsx scripts/generate-wallet.ts
  echo ""
  echo -e "${YELLOW}⚠️  Add the wallet details to your .env file${NC}"
fi

# Start Redis if Docker is available
if command -v docker &> /dev/null; then
  print_step "Starting Redis with Docker..."
  docker run -d --name agent-bounty-redis -p 6379:6379 redis:7-alpine 2>/dev/null || true
else
  echo -e "${YELLOW}⚠️  Docker not found. Please install Redis manually or use Docker.${NC}"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env with your API keys"
echo "   2. Run 'pnpm agent:dev' to start the agent"
echo "   3. Run 'pnpm web:dev' to start the frontend"
echo ""
echo "📚 Documentation: SPEC.md"
