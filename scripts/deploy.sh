#!/bin/bash
set -e

echo "🦞 Agent Bounty Deployment Script"
echo "=================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "⚠️  Please don't run as root. Run as a regular user with sudo access."
  exit 1
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
  echo -e "${GREEN}➤ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
  print_step "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  echo "Please log out and back in, then run this script again."
  exit 0
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  print_step "Installing Docker Compose..."
  sudo apt-get update
  sudo apt-get install -y docker-compose-plugin
fi

# Check Node.js
if ! command -v node &> /dev/null; then
  print_step "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  print_step "Installing pnpm..."
  npm install -g pnpm
fi

# Install Tailscale for secure access
if ! command -v tailscale &> /dev/null; then
  print_step "Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sh
  print_warning "Run 'sudo tailscale up' after deployment to connect"
fi

# Setup environment
print_step "Setting up environment..."

if [ ! -f .env ]; then
  cp .env.example .env
  print_warning "Created .env from example. Please edit with your API keys!"
  print_warning "Required: ANTHROPIC_API_KEY, AGENT_WALLET_PRIVATE_KEY"
  echo ""
  echo "Edit .env file and run this script again."
  exit 1
fi

# Validate critical environment variables
source .env

if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-..." ]; then
  print_warning "ANTHROPIC_API_KEY not set in .env"
  exit 1
fi

if [ -z "$AGENT_WALLET_PRIVATE_KEY" ] || [ "$AGENT_WALLET_PRIVATE_KEY" = "0x..." ]; then
  print_warning "AGENT_WALLET_PRIVATE_KEY not set in .env"
  exit 1
fi

# Build and start services
print_step "Building and starting services..."
docker compose up -d --build

# Wait for services to be healthy
print_step "Waiting for services to start..."
sleep 10

# Check health
if curl -s http://localhost:3001/health | grep -q "ok"; then
  echo ""
  echo "✅ Agent Bounty is running!"
  echo ""
  echo "📍 Local Access:"
  echo "   API: http://localhost:3001"
  echo "   Health: http://localhost:3001/health"
  echo ""

  if command -v tailscale &> /dev/null; then
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "not connected")
    echo "📍 Tailscale Access (after 'sudo tailscale up'):"
    echo "   API: http://$TAILSCALE_IP:3001"
  fi

  echo ""
  echo "📊 View logs:"
  echo "   docker compose logs -f agent"
  echo ""
  echo "🛑 Stop services:"
  echo "   docker compose down"
else
  print_warning "Agent may not be fully started. Check logs:"
  echo "docker compose logs agent"
fi
