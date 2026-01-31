import 'dotenv/config';
import { AgentCore } from './core.js';
import { TwitterChannel } from './channels/twitter.js';
import { TelegramChannel } from './channels/telegram.js';
import { WebChannel } from './channels/web.js';
import { X402PaymentHandler } from './payments/x402.js';
import { PricingEngine } from './payments/pricing.js';
import { TaskQueue } from './queue/task-queue.js';
import { MemoryStore } from './memory/store.js';
import { A2AClient } from './a2a/client.js';
import { SkillRegistry } from './skills/registry.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('🦞 Starting Agent Bounty...');

  // Initialize core services
  const memory = new MemoryStore(config.redis.url);
  await memory.connect();
  logger.info('✅ Memory store connected');

  const payments = new X402PaymentHandler(
    config.wallet.privateKey as `0x${string}`,
    config.blockchain.network
  );
  logger.info(`✅ Payment handler initialized (wallet: ${await payments.getAddress()})`);

  const pricing = new PricingEngine();
  const taskQueue = new TaskQueue(config.redis.url);
  await taskQueue.connect();
  logger.info('✅ Task queue connected');

  // Initialize A2A client for agent-to-agent communication
  const a2a = new A2AClient({
    agentId: config.agent.id,
    agentCard: config.agent.card,
    endpoint: config.a2a.endpoint
  });
  logger.info('✅ A2A client initialized');

  // Initialize skill registry
  const skills = new SkillRegistry();
  await skills.loadSkills();
  logger.info(`✅ Loaded ${skills.count()} skills`);

  // Initialize agent core
  const agent = new AgentCore({
    memory,
    payments,
    pricing,
    taskQueue,
    a2a,
    skills
  });

  // Initialize channels
  const channels = [];

  if (config.twitter.enabled) {
    const twitter = new TwitterChannel(agent, {
      username: config.twitter.username,
      password: config.twitter.password,
      email: config.twitter.email
    });
    await twitter.connect();
    channels.push(twitter);
    logger.info('✅ Twitter channel connected');
  }

  if (config.telegram.enabled) {
    const telegram = new TelegramChannel(agent, {
      token: config.telegram.token
    });
    await telegram.connect();
    channels.push(telegram);
    logger.info('✅ Telegram channel connected');
  }

  // Always enable web channel
  const web = new WebChannel(agent, {
    port: config.server.port
  });
  await web.start();
  channels.push(web);
  logger.info(`✅ Web channel started on port ${config.server.port}`);

  // Start task processor
  taskQueue.startProcessor(async (task) => {
    return await agent.executeTask(task);
  });
  logger.info('✅ Task processor started');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('🛑 Shutting down...');
    for (const channel of channels) {
      await channel.disconnect?.();
    }
    await taskQueue.disconnect();
    await memory.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('🦞 Agent Bounty is live!');
  logger.info(`   Wallet: ${await payments.getAddress()}`);
  logger.info(`   Balance: ${await payments.getBalance()} USDC`);
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
