'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/components/api';
import type { Level } from '@/lib/supabase/database.types';

const LEVELS: { value: Level; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'No tech background — everyday words only' },
  { value: 'some-code', label: 'Some code', hint: 'Know the basics, skip the hand-holding' },
  { value: 'dev', label: 'Developer', hint: 'Technical terms are fine' },
];

const TONES = ['friendly', 'straight to the point', 'playful', 'calm'];

interface Settings {
  level: Level;
  tone: string;
  display_name: string | null;
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);

  async function save(patch: Partial<Settings>) {
    const prev = settings;
    setSettings({ ...settings, ...patch });
    setStatus(null);
    try {
      await api('/api/me', { method: 'PATCH', body: patch });
      setStatus('Saved');
    } catch (err) {
      setSettings(prev);
      setStatus(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function signOut() {
    await api('/api/auth/sign-out', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <section>
        <h2 className="font-semibold">Explanation level</h2>
        <div className="mt-3 flex flex-col gap-2">
          {LEVELS.map((l) => (
            <label
              key={l.value}
              className={`flex cursor-pointer gap-3 rounded-xl border bg-surface p-3 ${settings.level === l.value ? 'border-accent' : 'border-line'}`}
            >
              <input
                type="radio"
                name="level"
                checked={settings.level === l.value}
                onChange={() => save({ level: l.value })}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>
                <span className="font-medium">{l.label}</span>
                <span className="block text-sm text-muted">{l.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Tone</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t}
              onClick={() => save({ tone: t })}
              className={`rounded-full border px-3 py-1.5 text-sm ${settings.tone === t ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Topics</h2>
        <p className="mt-1 text-sm text-muted">
          Edit or forget what HeyToolie thinks you&apos;re into on the{' '}
          <Link href="/topics" className="text-accent">
            Topics
          </Link>{' '}
          tab.
        </p>
      </section>

      {status && <p className="text-sm text-muted">{status}</p>}

      <button onClick={signOut} className="self-start text-sm text-danger">
        Sign out
      </button>
    </div>
  );
}
