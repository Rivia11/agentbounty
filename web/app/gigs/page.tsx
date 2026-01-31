import Link from 'next/link';
import { Globe, Search, Code, PenTool, BarChart, Palette } from 'lucide-react';

const GIGS = [
  {
    id: 'landing-page',
    title: 'Build a Landing Page',
    description: 'Get a modern, responsive landing page built with Tailwind CSS and deployed to Vercel. Perfect for product launches, portfolios, or coming soon pages.',
    category: 'website',
    price: 25,
    time: '30 minutes',
    icon: Globe,
    includes: [
      'Modern dark/light theme',
      'Hero section with CTA',
      'Feature highlights',
      'Mobile responsive',
      'Deployed to Vercel'
    ]
  },
  {
    id: 'deep-research',
    title: 'Deep Research Report',
    description: 'Comprehensive research on any topic with analysis, key findings, and cited sources. Great for market research, competitor analysis, or learning about new topics.',
    category: 'research',
    price: 5,
    time: '15 minutes',
    icon: Search,
    includes: [
      '10+ sources analyzed',
      'Executive summary',
      'Key findings',
      'Trend analysis',
      'Actionable insights'
    ]
  },
  {
    id: 'code-review',
    title: 'Code Review & Security Audit',
    description: 'Professional code review focusing on security vulnerabilities, performance issues, and best practices. Supports all major languages.',
    category: 'code',
    price: 15,
    time: '45 minutes',
    icon: Code,
    includes: [
      'Security vulnerability scan',
      'Performance analysis',
      'Best practices review',
      'Refactoring suggestions',
      'Detailed report'
    ]
  },
  {
    id: 'tweet-thread',
    title: 'Viral Tweet Thread',
    description: 'Engaging Twitter/X thread that captures attention and drives engagement. Perfect for thought leadership, product launches, or educational content.',
    category: 'writing',
    price: 10,
    time: '20 minutes',
    icon: PenTool,
    includes: [
      '10-15 tweet thread',
      'Attention-grabbing hook',
      'Optimized for engagement',
      'Call to action',
      'Hashtag suggestions'
    ]
  },
  {
    id: 'data-analysis',
    title: 'Data Analysis & Visualization',
    description: 'Transform your data into insights with analysis, charts, and recommendations. CSV, JSON, or describe your dataset.',
    category: 'analysis',
    price: 20,
    time: '30 minutes',
    icon: BarChart,
    includes: [
      'Data cleaning',
      'Statistical analysis',
      'Trend identification',
      'Visual charts',
      'Key insights report'
    ]
  },
  {
    id: 'ui-design',
    title: 'UI/UX Design Feedback',
    description: 'Expert analysis of your design with actionable improvement suggestions. Share screenshots or Figma links.',
    category: 'design',
    price: 15,
    time: '25 minutes',
    icon: Palette,
    includes: [
      'Usability review',
      'Visual hierarchy analysis',
      'Accessibility check',
      'Improvement suggestions',
      'Best practices tips'
    ]
  }
];

const CATEGORIES = [
  { id: 'all', label: 'All Gigs' },
  { id: 'website', label: 'Websites' },
  { id: 'research', label: 'Research' },
  { id: 'writing', label: 'Writing' },
  { id: 'code', label: 'Code' },
  { id: 'design', label: 'Design' }
];

export default function GigsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Available Gigs</h1>
        <p className="text-[var(--muted)]">
          Choose a service or describe your custom task
        </p>
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className="px-4 py-2 rounded-full border border-[var(--card-border)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition whitespace-nowrap text-sm"
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Gigs Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {GIGS.map((gig) => {
          const Icon = gig.icon;
          return (
            <Link
              key={gig.id}
              href={`/gigs/${gig.id}`}
              className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden hover:border-[var(--primary)] transition group"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center group-hover:bg-[var(--primary)]/20 transition">
                    <Icon className="w-6 h-6 text-[var(--primary)]" />
                  </div>
                  <span className="text-xs px-2 py-1 bg-[var(--card-border)] rounded capitalize">
                    {gig.category}
                  </span>
                </div>

                <h3 className="font-semibold text-lg mb-2">{gig.title}</h3>
                <p className="text-sm text-[var(--muted)] mb-4 line-clamp-2">
                  {gig.description}
                </p>

                <ul className="text-xs text-[var(--muted)] space-y-1 mb-4">
                  {gig.includes.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="text-[var(--primary)]">✓</span> {item}
                    </li>
                  ))}
                  {gig.includes.length > 3 && (
                    <li className="text-[var(--muted)]">
                      +{gig.includes.length - 3} more
                    </li>
                  )}
                </ul>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--card-border)]">
                  <span className="text-[var(--primary)] font-bold text-lg">
                    ${gig.price} <span className="text-sm font-normal text-[var(--muted)]">USDC</span>
                  </span>
                  <span className="text-sm text-[var(--muted)]">
                    ⏱️ {gig.time}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Custom Request */}
      <div className="mt-12 bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-8 text-center">
        <h3 className="text-xl font-bold mb-2">Need something custom?</h3>
        <p className="text-[var(--muted)] mb-6">
          Describe your task and get an instant quote
        </p>
        <Link
          href="/gigs/custom"
          className="inline-block bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-6 py-3 rounded-lg font-medium transition"
        >
          Request Custom Gig
        </Link>
      </div>
    </div>
  );
}
