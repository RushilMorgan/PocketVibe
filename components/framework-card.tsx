'use client';

import Link from 'next/link';
import { useState } from 'react';
import { KIND_LABEL, type Framework } from '@/lib/playbook/schema';

/**
 * One framework from the playbook. Closed, it's the name and one line; open,
 * its parts, when to use it, where it breaks, the source's example and the
 * questions it makes you ask. `children` are the actions under it.
 */
export function FrameworkCard({
  framework: f,
  defaultOpen = false,
  showSources = true,
  children,
}: {
  framework: Framework;
  defaultOpen?: boolean;
  showSources?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article id={`f-${f.id}`} className="scroll-mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold leading-snug">{f.name}</span>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">{KIND_LABEL[f.kind]}</span>
          </span>
          <span className={`mt-1 block text-sm leading-relaxed text-muted ${open ? '' : 'line-clamp-2'}`}>{f.gist}</span>
        </span>
        <span aria-hidden className={`mt-1 shrink-0 text-muted transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          {f.from && <p className="text-xs text-muted">From {f.from}</p>}

          {f.parts.length > 0 && (
            <ol className="mt-3 flex flex-col gap-2.5">
              {f.parts.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-sm leading-relaxed">
                    <span className="font-semibold">{p.label}</span>
                    {p.detail && <span className="text-muted"> · {p.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <Note label="Use it when" tone="accent">
            {f.use_when}
          </Note>
          {f.watch_out && (
            <Note label="Watch out" tone="warm">
              {f.watch_out}
            </Note>
          )}
          {f.example && (
            <Note label="The example given" tone="plain">
              {f.example}
            </Note>
          )}

          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Ask of your idea</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {f.questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <span aria-hidden className="text-accent">
                  ?
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ul>

          {showSources && f.sources.length > 0 && (
            <p className="mt-4 text-xs text-muted">
              From{' '}
              {f.sources.map((s, i) => (
                <span key={s.itemId}>
                  {i > 0 && ' · '}
                  <Link href={`/items/${s.itemId}`} className="font-medium text-accent">
                    {s.title ?? 'a save'}
                  </Link>
                </span>
              ))}
            </p>
          )}

          {children && <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}
        </div>
      )}
    </article>
  );
}

function Note({ label, tone, children }: { label: string; tone: 'accent' | 'warm' | 'plain'; children: React.ReactNode }) {
  const box = tone === 'accent' ? 'border-accent/25 bg-accent/10' : tone === 'warm' ? 'border-warm/30 bg-warm/10' : 'border-line bg-bg';
  const text = tone === 'accent' ? 'text-accent' : tone === 'warm' ? 'text-warm' : 'text-muted';
  return (
    <div className={`mt-3 rounded-xl border p-3 ${box}`}>
      <p className={`text-xs font-bold ${text}`}>{label}</p>
      <p className="mt-0.5 text-sm leading-relaxed">{children}</p>
    </div>
  );
}
