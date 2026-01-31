'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PaymentButton } from '@/components/PaymentButton';

const GIGS: Record<string, {
  title: string;
  description: string;
  longDescription: string;
  category: string;
  price: number;
  time: string;
  includes: string[];
  process: string[];
}> = {
  'landing-page': {
    title: 'Build a Landing Page',
    description: 'Modern, responsive landing page deployed to Vercel',
    longDescription: 'Get a beautiful, production-ready landing page built with modern web technologies. Your page will be mobile-responsive, fast-loading, and ready to share with the world. Includes deployment to Vercel with a shareable URL.',
    category: 'website',
    price: 25,
    time: '30 minutes',
    includes: [
      'Modern dark/light theme design',
      'Hero section with call-to-action',
      'Feature highlights section',
      'Testimonials or social proof',
      'Footer with links',
      'Fully mobile responsive',
      'Deployed to Vercel with live URL',
      'Source code provided'
    ],
    process: [
      'Analyze your requirements',
      'Generate optimized design',
      'Build with Tailwind CSS',
      'Deploy to Vercel',
      'Deliver live URL and code'
    ]
  },
  'deep-research': {
    title: 'Deep Research Report',
    description: 'Comprehensive research with sources and analysis',
    longDescription: 'Get thorough research on any topic with cited sources, trend analysis, and actionable insights. Perfect for market research, competitive analysis, learning new domains, or validating business ideas.',
    category: 'research',
    price: 5,
    time: '15 minutes',
    includes: [
      '10+ sources analyzed',
      'Executive summary',
      'Key findings with evidence',
      'Trend analysis',
      'Competitive landscape',
      'Actionable recommendations',
      'All sources cited',
      'Markdown format'
    ],
    process: [
      'Understand your research question',
      'Search multiple sources',
      'Analyze and synthesize findings',
      'Generate comprehensive report',
      'Review for accuracy'
    ]
  },
  'code-review': {
    title: 'Code Review & Security Audit',
    description: 'Professional security and quality code review',
    longDescription: 'Get your code reviewed by an AI expert. Covers security vulnerabilities, performance issues, code quality, and best practices. Supports JavaScript, TypeScript, Python, Go, Rust, and more.',
    category: 'code',
    price: 15,
    time: '45 minutes',
    includes: [
      'Security vulnerability scan',
      'OWASP Top 10 check',
      'Performance optimization tips',
      'Code quality assessment',
      'Best practices review',
      'Refactoring suggestions',
      'Line-by-line annotations',
      'Priority-ranked issues'
    ],
    process: [
      'Parse and understand code',
      'Run security analysis',
      'Check for performance issues',
      'Review against best practices',
      'Generate detailed report'
    ]
  },
  'tweet-thread': {
    title: 'Viral Tweet Thread',
    description: 'Engaging Twitter/X thread for maximum impact',
    longDescription: 'Get a professionally crafted Twitter/X thread designed for engagement. Perfect for thought leadership, product launches, educational content, or building your personal brand.',
    category: 'writing',
    price: 10,
    time: '20 minutes',
    includes: [
      '10-15 tweet thread',
      'Attention-grabbing hook',
      'Storytelling structure',
      'Engagement optimization',
      'Strategic CTAs',
      'Hashtag recommendations',
      'Best posting time advice',
      'Copy-paste ready'
    ],
    process: [
      'Understand your topic and goals',
      'Research supporting content',
      'Craft compelling narrative',
      'Optimize for engagement',
      'Format for Twitter'
    ]
  }
};

export default function GigPage() {
  const params = useParams();
  const slug = params.slug as string;
  const gig = GIGS[slug];

  const [status, setStatus] = useState<'idle' | 'paying' | 'processing' | 'complete'>('idle');
  const [taskId, setTaskId] = useState<string>('');

  if (!gig) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Gig not found</h1>
        <Link href="/gigs" className="text-[var(--primary)] hover:underline">
          Browse all gigs
        </Link>
      </div>
    );
  }

  const handlePaymentSuccess = (newTaskId: string) => {
    setTaskId(newTaskId);
    setStatus('processing');
  };

  return (
    <div>
      <Link
        href="/gigs"
        className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-white mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to gigs
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <span className="text-xs px-2 py-1 bg-[var(--card-border)] rounded capitalize mb-2 inline-block">
              {gig.category}
            </span>
            <h1 className="text-3xl font-bold mb-4">{gig.title}</h1>
            <p className="text-lg text-[var(--muted)]">{gig.longDescription}</p>
          </div>

          {/* What's Included */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">What&apos;s Included</h2>
            <ul className="grid md:grid-cols-2 gap-3">
              {gig.includes.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-[var(--primary)] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Process */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">How It Works</h2>
            <ol className="space-y-4">
              {gig.process.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-[var(--primary)] rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Sidebar - Order Card */}
        <div className="lg:col-span-1">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 sticky top-24">
            {status === 'idle' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-3xl font-bold text-[var(--primary)]">
                    ${gig.price}
                  </span>
                  <span className="text-[var(--muted)]">USDC</span>
                </div>

                <div className="flex items-center gap-2 text-[var(--muted)] mb-6">
                  <Clock className="w-4 h-4" />
                  <span>Delivered in {gig.time}</span>
                </div>

                <PaymentButton
                  gigId={slug}
                  priceUsdc={gig.price.toString()}
                  onSuccess={handlePaymentSuccess}
                />

                <p className="text-xs text-[var(--muted)] text-center mt-4">
                  Powered by x402 on Base • &lt;$0.01 fees
                </p>
              </>
            )}

            {status === 'paying' && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--primary)]" />
                <p className="font-medium">Waiting for payment...</p>
                <p className="text-sm text-[var(--muted)] mt-2">
                  Confirm the transaction in your wallet
                </p>
              </div>
            )}

            {status === 'processing' && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--primary)]" />
                <p className="font-medium">Processing your request...</p>
                <p className="text-sm text-[var(--muted)] mt-2">
                  Task ID: {taskId.slice(0, 8)}...
                </p>
                <Link
                  href={`/status/${taskId}`}
                  className="text-[var(--primary)] hover:underline text-sm mt-4 inline-block"
                >
                  View status →
                </Link>
              </div>
            )}

            {status === 'complete' && (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-[var(--primary)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6" />
                </div>
                <p className="font-medium">Completed!</p>
                <Link
                  href={`/status/${taskId}`}
                  className="text-[var(--primary)] hover:underline text-sm mt-4 inline-block"
                >
                  View results →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
