# Agent Bounty - Deployment Checklist

## Quick Reference

**EC2 IP**: 18.226.177.132
**Wallet**: 0x4582F8AFc3418Cfe1Cb3B0F14f859b81550a0A23

---

## Completed

- [x] AWS account created (agentbounty7@gmail.com)
- [x] EC2 instance launched (i-09caa760246e94b03)
- [x] Ubuntu 24.04 LTS configured
- [x] Node.js 20.20.0 installed
- [x] PM2 installed globally
- [x] Repository cloned from GitHub
- [x] Dependencies installed (npm install)
- [x] TypeScript built (npm run build)
- [x] Agent started with PM2
- [x] PM2 startup configured (auto-restart on reboot)
- [x] PM2 process list saved

---

## TODO - Action Required

### Immediate (Required for agent to work)

- [ ] **Update Anthropic API Key**
  - Location: `~/agentbounty/agent/.env`
  - Current: `sk-ant-api03-REPLACE-WITH-YOUR-KEY`
  - Action: Replace with real API key, then `pm2 restart agentbounty`

- [ ] **Open Port 3001**
  - AWS Console > EC2 > Security Groups
  - Add inbound rule: TCP 3001 from 0.0.0.0/0

- [ ] **Fund Wallet with USDC**
  - Network: Base Mainnet
  - Address: `0x4582F8AFc3418Cfe1Cb3B0F14f859b81550a0A23`

### Optional Enhancements

- [ ] Set up custom domain
- [ ] Configure nginx reverse proxy
- [ ] Install SSL certificate (HTTPS)
- [ ] Install Redis for persistence
- [ ] Deploy web frontend to Vercel
- [ ] Add Twitter credentials
- [ ] Add Telegram bot token
- [ ] Set up CloudWatch monitoring

---

## Verification Steps

After completing the required TODOs:

1. **Test API endpoint**
   ```bash
   curl http://18.226.177.132:3001/health
   ```

2. **Check agent logs**
   ```bash
   pm2 logs agentbounty
   ```

3. **Verify wallet balance**
   - https://basescan.org/address/0x4582F8AFc3418Cfe1Cb3B0F14f859b81550a0A23

---

## Quick Commands

```bash
# SSH to EC2 (from local machine with .pem file)
ssh -i agentbounty-key.pem ubuntu@18.226.177.132

# Or use AWS Console > EC2 > Connect > EC2 Instance Connect

# On EC2:
pm2 status              # Check status
pm2 logs agentbounty    # View logs
pm2 restart agentbounty # Restart after config changes
```
