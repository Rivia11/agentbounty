import { NextResponse } from 'next/server';

// Proxy to agent API for same-origin requests
const AGENT_API = process.env.AGENT_API_URL || 'http://localhost:3001';

export async function GET() {
  return NextResponse.json({
    name: 'Agent Bounty API',
    version: '1.0.0',
    agent: AGENT_API
  });
}
