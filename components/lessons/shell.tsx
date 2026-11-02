'use client';

import Link from 'next/link';
import { TEMPLATE_LABEL, TEMPLATES, type Template } from '@/lib/lessons/schema';

/** Props every template player receives from the /play page. */
export interface PlayerProps<L> {
  lesson: L;
  itemHref: string;
  /** Item kind, so "Spot the bug" is only offered for tech items. */
  itemKind: string | null;
  onFinish: (score: number) => void;
  /** Another lesson on the same item; with a template, the user's override. */
  onAnother: (template?: Template) => void;
  anotherState: 'idle' | 'working' | 'failed';
}

/** A light tap on each answer, where the device supports it. */
export function haptic() {
  try {
    navigator.vibrate?.(20);
  } catch {}
}

export function verdict(score: number, total: number): string {
  if (score === total) return 'Perfect. You’ve got this one.';
  if (total >= 3 && score === total - 1) return 'Nearly flawless.';
  if (score >= Math.ceil(total / 2)) return 'Solid — the notes fill the gaps.';
  return 'Tricky one. Worth another go.';
}

/** Full-screen frame: close button + segmented progress bar (done of total). */
export function LessonShell({
  itemHref,
  done,
  total,
  children,
}: {
  itemHref: string;
  done: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
        <Link href={itemHref} aria-label="Close lesson" className="-ml-2 p-2 text-xl leading-none text-muted">
          ✕
        </Link>
        <ol className="flex flex-1 gap-1.5" aria-label={`Progress: ${done} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <li key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < done ? 'bg-accent' : 'bg-line'}`} />
          ))}
        </ol>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto px-5 pb-4">{children}</main>
    </div>
  );
}

export function Intro({
  kicker,
  concept,
  intro,
  start,
  onStart,
}: {
  kicker: string;
  concept: string;
  intro: string;
  start: string;
  onStart: () => void;
}) {
  return (
    <>
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">{kicker}</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight">{concept}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{intro}</p>
      </div>
      <BigButton onClick={onStart} autoFocus>
        {start}
      </BigButton>
    </>
  );
}

/**
 * Score (when there is one), takeaway, Another on this topic, a "try it as…"
 * override row, and Back to item.
 */
export function EndScreen({
  score,
  total,
  headline,
  takeaway,
  current,
  itemHref,
  itemKind,
  onAnother,
  anotherState,
}: {
  score?: number;
  total?: number;
  headline?: string;
  takeaway: string;
  current: Template;
  itemHref: string;
  itemKind: string | null;
  onAnother: (template?: Template) => void;
  anotherState: 'idle' | 'working' | 'failed';
}) {
  const others = TEMPLATES.filter((t) => t !== current && (t !== 'spot_bug' || itemKind === 'tech'));
  const busy = anotherState === 'working';
  return (
    <>
      <div className="flex flex-1 flex-col justify-center text-center">
        {score !== undefined && total !== undefined ? (
          <>
            <p className="text-6xl font-semibold tracking-tight">
              {score}
              <span className="text-muted">/{total}</span>
            </p>
            <p className="mt-2 text-lg">{verdict(score, total)}</p>
          </>
        ) : (
          <p className="text-3xl font-semibold tracking-tight">{headline}</p>
        )}
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Remember this</p>
          <p className="mt-1.5 text-lg leading-snug">{takeaway}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <BigButton onClick={() => onAnother()} disabled={busy}>
          {busy ? 'Writing a new one…' : 'Another on this topic'}
        </BigButton>
        {anotherState === 'failed' && <p className="text-center text-sm text-danger">Couldn&apos;t write another one — try again.</p>}
        <p className="mt-1 text-center text-sm text-muted">
          or try it as{' '}
          {others.map((t, i) => (
            <span key={t}>
              {i > 0 && ' · '}
              <button onClick={() => onAnother(t)} disabled={busy} className="text-accent disabled:opacity-50">
                {TEMPLATE_LABEL[t].toLowerCase()}
              </button>
            </span>
          ))}
        </p>
        <Link href={itemHref} className="rounded-2xl py-3 text-center font-medium text-muted">
          Back to item
        </Link>
      </div>
    </>
  );
}

export function BigButton({
  ref,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      {...props}
      className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-on-accent active:scale-[0.99] disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** The right/wrong panel shared by quiz and spot-the-bug. */
export function Verdict({ right, children }: { right: boolean; children: React.ReactNode }) {
  return (
    <div role="status" className="mt-5 rounded-2xl bg-surface p-4">
      <p className={`font-semibold ${right ? 'text-success' : 'text-danger'}`}>{right ? 'Right!' : 'Not quite.'}</p>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  );
}
