#!/usr/bin/env npx tsx

/**
 * Generate a new wallet for the agent
 * Run with: npx tsx scripts/generate-wallet.ts
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

console.log('🔐 Generating new agent wallet...\n');

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log('='.repeat(60));
console.log('⚠️  SAVE THESE SECURELY - NEVER SHARE THE PRIVATE KEY');
console.log('='.repeat(60));
console.log('');
console.log('Address:     ', account.address);
console.log('Private Key: ', privateKey);
console.log('');
console.log('='.repeat(60));
console.log('');
console.log('Add to your .env file:');
console.log(`AGENT_WALLET_ADDRESS=${account.address}`);
console.log(`AGENT_WALLET_PRIVATE_KEY=${privateKey}`);
console.log('');
console.log('💡 Fund this wallet with USDC on Base to enable payments');
console.log('   https://basescan.org/address/' + account.address);
