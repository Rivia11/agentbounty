'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Check, Loader2, AlertCircle, Copy } from 'lucide-react';

interface Task {
  id: string;
  status: 'pending_payment' | 'paid' | 'in_progress' | 'completed' | 'failed';
  description: string;
  category: string;
  priceUsdc: string;
  paidTxHash?: string;
  deliverable?: string;
  createdAt: string;
  completedAt?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function StatusPage() {
  const params = useParams();
  const taskId = params.taskId as string;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await fetch(`${API_URL}/task/${taskId}`);
        if (!response.ok) {
          throw new Error('Task not found');
        }
        const data = await response.json();
        setTask(data.task);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load task');
      } finally {
        setLoading(false);
      }
    };

    fetchTask();

    // Poll for updates if not completed
    const interval = setInterval(() => {
      if (task?.status !== 'completed' && task?.status !== 'failed') {
        fetchTask();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [taskId, task?.status]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--primary)]" />
        <p>Loading task...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <h1 className="text-2xl font-bold mb-2">Task not found</h1>
        <p className="text-[var(--muted)] mb-4">{error || 'The task you\'re looking for doesn\'t exist.'}</p>
        <Link href="/gigs" className="text-[var(--primary)] hover:underline">
          Browse gigs
        </Link>
      </div>
    );
  }

  const statusConfig = {
    pending_payment: {
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      label: 'Awaiting Payment',
      animate: false
    },
    paid: {
      icon: Clock,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      label: 'Queued',
      animate: false
    },
    in_progress: {
      icon: Loader2,
      color: 'text-[var(--primary)]',
      bgColor: 'bg-[var(--primary)]/10',
      label: 'In Progress',
      animate: true
    },
    completed: {
      icon: Check,
      color: 'text-[var(--primary)]',
      bgColor: 'bg-[var(--primary)]/10',
      label: 'Completed',
      animate: false
    },
    failed: {
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      label: 'Failed',
      animate: false
    }
  };

  const status = statusConfig[task.status];
  const StatusIcon = status.icon;

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/gigs"
        className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-white mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to gigs
      </Link>

      {/* Status Header */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 ${status.bgColor} rounded-full flex items-center justify-center`}>
            <StatusIcon className={`w-6 h-6 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{status.label}</h1>
            <p className="text-[var(--muted)] text-sm">Task ID: {task.id.slice(0, 8)}...</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-[var(--muted)]">Category</span>
            <p className="capitalize">{task.category}</p>
          </div>
          <div>
            <span className="text-[var(--muted)]">Price</span>
            <p>{task.priceUsdc} USDC</p>
          </div>
          <div>
            <span className="text-[var(--muted)]">Created</span>
            <p>{new Date(task.createdAt).toLocaleString()}</p>
          </div>
        </div>

        {task.paidTxHash && (
          <div className="mt-4 pt-4 border-t border-[var(--card-border)]">
            <span className="text-[var(--muted)] text-sm">Payment Transaction</span>
            <a
              href={`https://basescan.org/tx/${task.paidTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[var(--primary)] hover:underline truncate"
            >
              {task.paidTxHash}
            </a>
          </div>
        )}
      </div>

      {/* Task Description */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Request</h2>
        <p className="text-[var(--muted)]">{task.description}</p>
      </div>

      {/* Deliverable */}
      {task.deliverable && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Deliverable</h2>
            <button
              onClick={() => copyToClipboard(task.deliverable!)}
              className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-white transition"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="bg-[var(--background)] rounded-lg p-4 overflow-auto max-h-96">
            <pre className="text-sm whitespace-pre-wrap">{task.deliverable}</pre>
          </div>
          {task.completedAt && (
            <p className="text-sm text-[var(--muted)] mt-4">
              Completed at {new Date(task.completedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Progress for in-progress tasks */}
      {task.status === 'in_progress' && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--primary)]" />
          <p className="font-medium">Working on your request...</p>
          <p className="text-sm text-[var(--muted)] mt-2">
            This page will automatically update when complete
          </p>
        </div>
      )}
    </div>
  );
}
