'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/api';
import type { ItemRow } from '@/lib/supabase/database.types';

/** Floating + button above the tab bar; opens a sheet to paste a link (for apps with no share button). */
export function SaveButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const canPaste = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function paste() {
    try {
      setUrl((await navigator.clipboard.readText()).trim());
    } catch {
      input.current?.focus();
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { item } = await api<{ item: ItemRow }>('/api/items', { body: { url } });
      router.push(`/items/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl justify-end px-4">
        <button
          onClick={() => setOpen(true)}
          aria-label="Save a link"
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl font-light text-on-accent shadow-lg shadow-black/25 active:scale-95"
        >
          +
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={() => setOpen(false)}>
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-xl rounded-t-3xl bg-surface p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <h2 className="text-lg font-bold">Save a link</h2>
            <p className="mt-0.5 text-sm text-muted">Tip: share straight from YouTube or TikTok and it lands here.</p>
            <div className="mt-4 flex gap-2">
              <input
                ref={input}
                type="url"
                required
                inputMode="url"
                placeholder="https://youtube.com/shorts/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
              />
              {canPaste && !url && (
                <button type="button" onClick={paste} className="rounded-xl border border-line px-3 text-sm font-medium">
                  Paste
                </button>
              )}
            </div>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <button disabled={saving} className="mt-3 w-full rounded-xl bg-accent py-3 font-semibold text-on-accent disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
