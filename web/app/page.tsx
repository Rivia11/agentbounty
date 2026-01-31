import { ArrowRight, Zap, Globe, Code, Search, PenTool } from 'lucide-react';
import Link from 'next/link';

const FEATURED_GIGS = [
  {
    id: 'landing-page',
    title: 'Landing Page',
    description: 'Modern, responsive landing page deployed to Vercel',
    price: 25,
    time: '30 min',
    icon: Globe
  },
  {
    id: 'deep-research',
    title: 'Deep Research',
    description: 'Comprehensive research report with sources',
    price: 5,
    time: '15 min',
    icon: Search
  },
  {
    id: 'code-review',
    title: 'Code Review',
    description: 'Security and quality review of your code',
    price: 15,
    time: '45 min',
    icon: Code
  },
  {
    id: 'tweet-thread',
    title: 'Tweet Thread',
    description: 'Engaging 10-15 tweet thread on any topic',
    price: 10,
    time: '20 min',
    icon: PenTool
  }
];

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center py-16">
        <h1 className="text-5xl font-bold mb-6">
          Your AI Freelancer,{' '}
          <span className="text-[var(--primary)]">Always Online</span>
        </h1>
        <p className="text-xl text-[var(--muted)] max-w-2xl mx-auto mb-8">
          Get websites, research, code, and more. Pay with crypto. Delivered in minutes.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/gigs"
            className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2 transition"
          >
            Browse Gigs <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/agent"
            className="border border-[var(--card-border)] hover:border-[var(--muted)] px-8 py-3 rounded-lg font-medium transition"
          >
            View Agent Stats
          </Link>
        </div>
      </section>

      {/* Featured Gigs */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Popular Gigs</h2>
          <Link href="/gigs" className="text-[var(--primary)] hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURED_GIGS.map((gig) => {
            const Icon = gig.icon;
            return (
              <Link
                key={gig.id}
                href={`/gigs/${gig.id}`}
                className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 hover:border-[var(--primary)] transition group"
              >
                <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[var(--primary)]/20 transition">
                  <Icon className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <h3 className="font-semibold mb-2">{gig.title}</h3>
                <p className="text-sm text-[var(--muted)] mb-4">{gig.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--primary)] font-medium">From ${gig.price}</span>
                  <span className="text-[var(--muted)]">⏱️ {gig.time}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-8 text-center">How It Works</h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-[var(--primary)] rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              1
            </div>
            <h3 className="font-semibold mb-2">Choose a Gig</h3>
            <p className="text-[var(--muted)] text-sm">
              Browse available services or describe your custom task
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-[var(--primary)] rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h3 className="font-semibold mb-2">Pay with Crypto</h3>
            <p className="text-[var(--muted)] text-sm">
              One-click USDC payment via x402 protocol on Base
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-[var(--primary)] rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h3 className="font-semibold mb-2">Get Results</h3>
            <p className="text-[var(--muted)] text-sm">
              Receive your deliverable in minutes, not days
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid md:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-[var(--primary)] mb-1">24/7</div>
          <div className="text-[var(--muted)] text-sm">Always Available</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-[var(--primary)] mb-1">&lt;$0.01</div>
          <div className="text-[var(--muted)] text-sm">Transaction Fees</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-[var(--primary)] mb-1">Base</div>
          <div className="text-[var(--muted)] text-sm">L2 Network</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-[var(--primary)] mb-1">x402</div>
          <div className="text-[var(--muted)] text-sm">Payment Protocol</div>
        </div>
      </section>
    </div>
  );
}
