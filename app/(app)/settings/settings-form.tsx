'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/components/api';
import { SMART_MODELS } from '@/lib/ai/models';
import { formatSlot, REMINDER_SLOTS } from '@/lib/nudges/reminders';
import type { Level } from '@/lib/supabase/database.types';
import { UsageCard } from './usage-card';

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
  /** null = the server default (`defaultModel`). */
  smart_model: string | null;
  /** Minutes after local midnight; [] = reminders off. */
  reminder_times: number[];
  /** IANA zone, kept in step with the device by TimezoneSync. */
  timezone: string;
}

export function SettingsForm({ initial, defaultModel }: { initial: Settings; defaultModel: string }) {
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

  const [digest, setDigest] = useState<'idle' | 'sending' | 'queued' | 'failed'>('idle');

  async function sendDigest() {
    setDigest('sending');
    try {
      await api('/api/digests', { method: 'POST' });
      setDigest('queued');
    } catch {
      setDigest('failed');
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
        <h2 className="font-semibold">AI model</h2>
        <p className="mt-1 text-sm text-muted">
          Writes your explanations, what-ifs, lessons, diagrams and chat answers. Watching videos and reading recipes always
          uses Gemini 3.8 Flash.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {SMART_MODELS.map((m) => {
            const selected = (settings.smart_model ?? defaultModel) === m.id;
            return (
              <label
                key={m.id}
                className={`flex cursor-pointer gap-3 rounded-xl border bg-surface p-3 ${selected ? 'border-accent' : 'border-line'}`}
              >
                <input
                  type="radio"
                  name="smart_model"
                  checked={selected}
                  onChange={() => save({ smart_model: m.id })}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  <span className="font-medium">{m.label}</span>
                  {m.id === defaultModel && <span className="ml-2 text-xs text-muted">default</span>}
                  <span className="block text-sm text-muted">{m.blurb}</span>
                  <span className="block text-xs text-muted">{m.cost}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <UsageCard />

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

      <Reminders
        times={settings.reminder_times}
        timezone={settings.timezone}
        onChange={(reminder_times) => save({ reminder_times })}
      />

      <section>
        <h2 className="font-semibold">Weekly digest</h2>
        <p className="mt-1 text-sm text-muted">
          Sundays at 18:00 by notification and email: what you saved, 3 new finds per top topic, and a what-if you haven&apos;t opened.
        </p>
        <button
          onClick={sendDigest}
          disabled={digest === 'sending' || digest === 'queued'}
          className="mt-3 rounded-xl border border-line bg-surface px-4 py-2 text-sm disabled:opacity-60"
        >
          {digest === 'sending' ? 'Starting…' : digest === 'queued' ? 'On its way — about a minute' : 'Send me this week’s digest now'}
        </button>
        {digest === 'failed' && <p className="mt-2 text-sm text-danger">Couldn&apos;t start it — try again.</p>}
      </section>

      {status && <p className="text-sm text-muted">{status}</p>}

      <button onClick={signOut} className="self-start text-sm text-danger">
        Sign out
      </button>
    </div>
  );
}

/** Off / once / twice a day, and when (half-hourly, 07:00–21:30 in the user's time zone). */
function Reminders({ times, timezone, onChange }: { times: number[]; timezone: string; onChange: (times: number[]) => void }) {
  const count = times.length;
  const setCount = (n: number) => {
    if (n === 0) return onChange([]);
    // Back to once: keep the later time (the streak and Wednesday nudges use the day's last slot).
    if (n === 1) return onChange([times.length ? Math.max(...times) : 1080]);
    const first = times[0] ?? 1080;
    const second = times[1] ?? (first === 600 ? 1080 : 600);
    onChange([first, second].sort((a, b) => a - b));
  };
  const setTime = (i: number, minutes: number) => {
    const next = [...times];
    next[i] = minutes;
    onChange(next.sort((a, b) => a - b));
  };
  const options = [
    { n: 0, label: 'Off' },
    { n: 1, label: 'Once a day' },
    { n: 2, label: 'Twice a day' },
  ];

  return (
    <section>
      <h2 className="font-semibold">Reminders</h2>
      <p className="mt-1 text-sm text-muted">
        A nudge when a review card is due, a Wednesday check-in, and a heads-up before your streak breaks. Never more
        than you pick here, and they pause if you ignore a few.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1">
        {options.map((o) => (
          <button
            key={o.n}
            onClick={() => setCount(o.n)}
            aria-pressed={count === o.n}
            className={`rounded-lg py-2 text-sm font-medium ${count === o.n ? 'bg-accent text-on-accent' : 'text-muted'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {count > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {times.map((t, i) => (
            <label key={i} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5">
              <span className="text-sm">{count === 1 ? 'At' : i === 0 ? 'First' : 'Second'}</span>
              <select
                value={t}
                onChange={(e) => setTime(i, Number(e.target.value))}
                className="rounded-lg border border-line bg-bg px-2 py-1.5 text-sm font-medium"
              >
                {REMINDER_SLOTS.map((m) => (
                  <option key={m} value={m} disabled={times.some((other, j) => j !== i && other === m)}>
                    {formatSlot(m)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p className="text-xs text-muted">Your local time ({timezone.replace(/_/g, ' ')}) — it follows your phone.</p>
        </div>
      )}
    </section>
  );
}
