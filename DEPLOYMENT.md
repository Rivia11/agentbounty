# Agent Bounty - EC2 Deployment Documentation

## Deployment Summary

**Date**: January 31, 2026
**Instance**: i-09caa760246e94b03
**Region**: us-east-2 (Ohio)
**Public IP**: 18.226.177.132
**OS**: Ubuntu 24.04 LTS

---

## Completed Steps

### 1. AWS Account Setup
- [x] Created AWS account (AgentBounty)
- [x] Email: agentbounty7@gmail.com
- [x] Verified email with code 844275

### 2. EC2 Instance Creation
- [x] Launched t2.micro instance (free tier eligible)
- [x] Selected Ubuntu 24.04 LTS AMI
- [x] Created key pair: `agentbounty-key`
- [x] Configured security group with:
  - [x] SSH (port 22)
  - [x] HTTP (port 80)
  - [x] HTTPS (port 443)
- [x] Instance ID: i-09caa760246e94b03

### 3. Server Configuration
- [x] Connected via EC2 Instance Connect (browser-based SSH)
- [x] Updated apt package lists
- [x] Installed Node.js 20.20.0 via NodeSource repository
- [x] Installed PM2 globally (133 packages)

### 4. Application Deployment
- [x] Cloned repository from GitHub using Personal Access Token
  ```
  git clone https://<YOUR_GITHUB_PAT>@github.com/agentbounty69/agentbounty.git
  ```
- [x] Navigated to agent directory
- [x] Installed npm dependencies (276 packages)
- [x] Created `.env` configuration file
- [x] Built TypeScript project with tsup (dist/index.js - 83KB)

### 5. Process Management
- [x] Started agent with PM2: `pm2 start dist/index.js --name agentbounty`
- [x] Configured PM2 startup script for systemd
- [x] Saved PM2 process list for auto-recovery

### 6. Verification
- [x] Agent status: **ONLINE**
- [x] PID: 2771
- [x] Memory usage: ~35MB
- [x] Web server listening on port 3001
- [x] All core services initialized:
  - [x] Memory store (in-memory fallback)
  - [x] Payment handler
  - [x] Task queue
  - [x] A2A client
  - [x] 11 skills loaded

---

## Pending Steps (Action Required)

### High Priority

- [ ] **Add Anthropic API Key**
  ```bash
  # SSH into EC2 or use Instance Connect
  nano ~/agentbounty/agent/.env
  # Replace: ANTHROPIC_API_KEY=sk-ant-api03-REPLACE-WITH-YOUR-KEY
  # With your actual Anthropic API key
  pm2 restart agentbounty
  ```

- [ ] **Open Port 3001 in Security Group**
  1. Go to AWS Console > EC2 > Security Groups
  2. Find the security group for instance i-09caa760246e94b03
  3. Edit inbound rules
  4. Add rule: Custom TCP, Port 3001, Source 0.0.0.0/0
  5. Save rules

- [ ] **Fund the Agent Wallet**
  - Wallet Address: `<YOUR_WALLET_ADDRESS>`
  - Network: Base Mainnet
  - Send USDC to enable payment processing

### Medium Priority

- [ ] **Set up domain name** (optional)
  - Point a domain to 18.226.177.132
  - Configure nginx as reverse proxy for port 3001

- [ ] **Enable HTTPS** (optional)
  - Install certbot
  - Obtain SSL certificate
  - Configure nginx SSL termination

- [ ] **Deploy Web Frontend**
  - Build and deploy the Next.js web app
  - Configure NEXT_PUBLIC_API_URL to point to EC2

### Low Priority

- [ ] **Install Redis** (optional, for persistence)
  ```bash
  sudo apt install redis-server -y
  sudo systemctl enable redis-server
  ```

- [ ] **Set up monitoring**
  - PM2 Plus or custom monitoring
  - CloudWatch alerts

- [ ] **Configure Twitter/Telegram channels**
  - Add credentials to .env file
  - Restart agent

---

## Configuration Files

### Environment Variables (.env)
Location: `~/agentbounty/agent/.env`

```env
# Required - MUST UPDATE
ANTHROPIC_API_KEY=sk-ant-api03-REPLACE-WITH-YOUR-KEY

# Wallet - GENERATE NEW KEYS, NEVER COMMIT REAL KEYS
AGENT_WALLET_PRIVATE_KEY=0x<YOUR_PRIVATE_KEY_HERE>
AGENT_WALLET_ADDRESS=0x<YOUR_WALLET_ADDRESS_HERE>

# Database (using in-memory fallback)
REDIS_URL=redis://localhost:6379

# Server
PORT=3001
NODE_ENV=production
```

### PM2 Ecosystem
- Process name: `agentbounty`
- Script: `/home/ubuntu/agentbounty/agent/dist/index.js`
- Mode: fork
- Auto-restart: enabled

---

## Useful Commands

### PM2 Management
```bash
pm2 status              # Check process status
pm2 logs agentbounty    # View logs (live)
pm2 logs agentbounty --lines 100  # View last 100 lines
pm2 restart agentbounty # Restart the agent
pm2 stop agentbounty    # Stop the agent
pm2 delete agentbounty  # Remove from PM2
pm2 monit               # Interactive monitor
```

### Application Management
```bash
cd ~/agentbounty/agent
git pull                # Update code
npm install             # Install new dependencies
npm run build           # Rebuild TypeScript
pm2 restart agentbounty # Apply changes
```

### System Commands
```bash
sudo systemctl status pm2-ubuntu  # Check PM2 service
sudo reboot                       # Reboot (PM2 will auto-start)
```

---

## Access Points

| Service | URL/Address |
|---------|-------------|
| EC2 Console | https://us-east-2.console.aws.amazon.com/ec2 |
| Agent API | http://18.226.177.132:3001 (after opening port) |
| Agent Wallet | <YOUR_WALLET_ADDRESS> |
| BaseScan | https://basescan.org/address/<YOUR_WALLET_ADDRESS> |

---

## Troubleshooting

### Agent not starting
```bash
pm2 logs agentbounty --err  # Check error logs
cat ~/agentbounty/agent/.env  # Verify config
```

### Port 3001 not accessible
1. Check security group rules in AWS Console
2. Verify agent is running: `pm2 status`
3. Test locally: `curl http://localhost:3001`

### Out of memory
```bash
pm2 restart agentbounty --max-memory-restart 500M
```

---

## Security Notes

- Private key is stored in `.env` file on EC2
- Key pair file `agentbounty-key.pem` should be kept secure locally
- GitHub PAT used for cloning - consider rotating
- Security group should be reviewed for production use

---

## Changelog

### 2026-01-31
- Initial EC2 deployment
- Node.js 20.20.0 installed
- Agent running with PM2
- In-memory storage mode (no Redis)
