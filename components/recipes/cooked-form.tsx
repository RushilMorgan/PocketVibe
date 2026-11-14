'use client';

import { useState } from 'react';
import { api } from '@/components/api';
import type { Cook } from '@/lib/recipes/view';

/** "I cooked this": an optional 1–5 rating and a note for next time. */
export function CookedForm({ itemId, onSaved, onCancel }: { itemId: string; onSaved: (cook: Cook) => void; onCancel?: () => void }) {
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { cook } = await api<{ cook: Cook }>(`/api/recipes/${itemId}/cooked`, { body: { rating, note } });
      onSaved(cook);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-line bg-surface p-4 text-left">
      <p className="text-sm font-bold">How did it turn out?</p>
      <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} out of 5`}
            onClick={() => setRating(rating === n ? null : n)}
            className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${rating !== null && n <= rating ? 'bg-warm/15' : 'bg-bg grayscale'}`}
          >
            ⭐
          </button>
        ))}
      </div>
      <label className="mt-3 block text-sm font-bold" htmlFor={`note-${itemId}`}>
        A note for next time
      </label>
      <textarea
        id={`note-${itemId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="e.g. less salt, 5 minutes longer in the oven"
        className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />
      <div className="mt-3 flex gap-2">
        <button disabled={busy} className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-on-accent disabled:opacity-60">
          {busy ? 'Saving…' : 'Save'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium">
            Cancel
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </form>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5`} className="whitespace-nowrap">
      {'⭐'.repeat(rating)}
    </span>
  );
}
