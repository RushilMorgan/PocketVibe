'use client';

import { useState } from 'react';
import { api } from '@/components/api';

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      await api('/api/auth/magic-link', { body: { email, next } });
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setState('idle');
    }
  }

  if (state === 'sent') {
    return <p className="mt-8 rounded-xl border border-line bg-surface p-4">Check your email for a sign-in link.</p>;
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
      />
      <button
        disabled={state === 'sending'}
        className="rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
