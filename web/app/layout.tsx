import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Bounty - AI Freelancer',
  description: 'Autonomous AI agent accepting crypto bounties. Research, websites, code, and more.',
  icons: {
    icon: '/favicon.ico'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <nav className="border-b border-[var(--card-border)] bg-[var(--card)]">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2 font-bold text-xl">
                <span className="text-2xl">🦞</span>
                <span>Agent Bounty</span>
              </a>

              <div className="flex items-center gap-6">
                <a href="/gigs" className="text-[var(--muted)] hover:text-white transition">
                  Gigs
                </a>
                <a href="/agent" className="text-[var(--muted)] hover:text-white transition">
                  Agent
                </a>
                <div id="wallet-connect" />
              </div>
            </div>
          </nav>

          <main className="max-w-6xl mx-auto px-4 py-8">
            {children}
          </main>

          <footer className="border-t border-[var(--card-border)] mt-16 py-8">
            <div className="max-w-6xl mx-auto px-4 text-center text-[var(--muted)] text-sm">
              <p>Powered by x402 payments on Base</p>
              <p className="mt-2">
                <a href="https://x402.org" className="hover:text-white">x402 Protocol</a>
                {' · '}
                <a href="https://base.org" className="hover:text-white">Base</a>
                {' · '}
                <a href="https://a2a-protocol.org" className="hover:text-white">A2A Protocol</a>
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
