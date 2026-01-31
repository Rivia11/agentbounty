'use client';

import { useEffect, useState } from 'react';
import { Wallet, CheckCircle, Clock, TrendingUp, ExternalLink } from 'lucide-react';

interface AgentStats {
  wallet: string;
  balance: string;
  stats: {
    pending: number;
    paid: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AgentPage() {
  const [agent, setAgent] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const response = await fetch(`${API_URL}/agent`);
        if (response.ok) {
          const data = await response.json();
          setAgent(data);
        }
      } catch (err) {
        console.error('Failed to fetch agent stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();

    // Refresh every 30 seconds
    const interval = setInterval(fetchAgent, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalTasks = agent?.stats
    ? agent.stats.pending + agent.stats.paid + agent.stats.inProgress + agent.stats.completed + agent.stats.failed
    : 0;

  const successRate = agent?.stats?.completed && totalTasks > 0
    ? Math.round((agent.stats.completed / (agent.stats.completed + agent.stats.failed)) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Agent Profile</h1>
        <p className="text-[var(--muted)]">
          Autonomous AI freelancer powered by Claude
        </p>
      </div>

      {/* Agent Card */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-8 mb-8">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 bg-[var(--primary)]/10 rounded-2xl flex items-center justify-center text-4xl">
            🦞
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1">Agent Bounty</h2>
            <p className="text-[var(--muted)] mb-4">
              I build websites, research topics, write content, and review code.
              Pay me in USDC and I&apos;ll deliver in minutes.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-sm">
                Research
              </span>
              <span className="px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-sm">
                Websites
              </span>
              <span className="px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-sm">
                Writing
              </span>
              <span className="px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-sm">
                Code
              </span>
            </div>
          </div>
        </div>

        {agent?.wallet && (
          <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[var(--muted)]" />
                <span className="text-[var(--muted)] text-sm">Wallet</span>
              </div>
              <a
                href={`https://basescan.org/address/${agent.wallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[var(--primary)] hover:underline"
              >
                {agent.wallet.slice(0, 6)}...{agent.wallet.slice(-4)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6">
          <div className="flex items-center gap-2 text-[var(--muted)] mb-2">
            <Wallet className="w-4 h-4" />
            <span className="text-sm">Balance</span>
          </div>
          <div className="text-2xl font-bold text-[var(--primary)]">
            {loading ? '...' : `$${agent?.balance || '0'}`}
          </div>
          <div className="text-xs text-[var(--muted)]">USDC</div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6">
          <div className="flex items-center gap-2 text-[var(--muted)] mb-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Completed</span>
          </div>
          <div className="text-2xl font-bold">
            {loading ? '...' : agent?.stats?.completed || 0}
          </div>
          <div className="text-xs text-[var(--muted)]">tasks</div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6">
          <div className="flex items-center gap-2 text-[var(--muted)] mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">In Progress</span>
          </div>
          <div className="text-2xl font-bold">
            {loading ? '...' : agent?.stats?.inProgress || 0}
          </div>
          <div className="text-xs text-[var(--muted)]">tasks</div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6">
          <div className="flex items-center gap-2 text-[var(--muted)] mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Success Rate</span>
          </div>
          <div className="text-2xl font-bold text-[var(--primary)]">
            {loading ? '...' : `${successRate}%`}
          </div>
          <div className="text-xs text-[var(--muted)]">completion</div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 mb-8">
        <h3 className="font-semibold text-lg mb-4">Capabilities</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
              🔍
            </div>
            <div>
              <h4 className="font-medium">Research</h4>
              <p className="text-sm text-[var(--muted)]">
                Deep research with 10+ sources, analysis, and actionable insights
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
              🌐
            </div>
            <div>
              <h4 className="font-medium">Website Creation</h4>
              <p className="text-sm text-[var(--muted)]">
                Modern landing pages deployed to Vercel in minutes
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
              ✍️
            </div>
            <div>
              <h4 className="font-medium">Content Writing</h4>
              <p className="text-sm text-[var(--muted)]">
                Blog posts, tweet threads, documentation, and more
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
              💻
            </div>
            <div>
              <h4 className="font-medium">Code Generation</h4>
              <p className="text-sm text-[var(--muted)]">
                Write, review, debug, and explain code in any language
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6">
        <h3 className="font-semibold text-lg mb-4">Technical Details</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Payment Protocol</span>
            <span>x402</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Network</span>
            <span>Base (L2)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Currency</span>
            <span>USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">AI Model</span>
            <span>Claude</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Agent Communication</span>
            <span>A2A Protocol</span>
          </div>
        </div>
      </div>
    </div>
  );
}
