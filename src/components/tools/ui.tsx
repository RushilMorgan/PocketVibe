import React from 'react';
import type { ToolAccent } from '../../lib/toolPages';
import type { GenerationStageEvent } from '../../types';
import { formatResetHint } from '../../lib/quotaMessage';
import { buildStageTimeline } from '../../lib/stageTimeline';

/**
 * Velix tool-page UI primitives. Every standalone tool page composes these so a
 * new page is declarative and on-brand by default — no hand-rolled markup. They
 * wrap the scoped `.tp-*` layer in index.css (light/frosted, near-black primary)
 * and take the per-type accent for the soft pastel treatment.
 */

/** Divider + uppercase section label. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-px flex-1 tp-divider" />
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] tp-ink-3">{children}</p>
      <div className="h-px flex-1 tp-divider" />
    </div>
  );
}

/** Small uppercase accent kicker above a heading. */
export function AccentEyebrow({ accent, children }: { accent: ToolAccent; children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: accent.accent }}>
      {children}
    </p>
  );
}

/** Rounded-square icon tile with the accent glow (hero / where-next). */
export function HeroTile({ accent, emoji, size = 'lg' }: { accent: ToolAccent; emoji: string; size?: 'lg' | 'sm' }) {
  const dims = size === 'lg' ? 'w-16 h-16 rounded-[20px] text-3xl' : 'w-11 h-11 rounded-[15px] text-xl';
  return (
    <div
      className={`${dims} flex items-center justify-center flex-shrink-0`}
      style={{ background: accent.accentSoft, boxShadow: size === 'lg' ? `0 12px 28px ${accent.accent}38` : undefined }}
    >
      {emoji}
    </div>
  );
}

/** Frosted card surface. `pad` adds the standard inner padding. */
export function ToolCard({
  children, className = '', style, pad = true, testId,
}: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; pad?: boolean; testId?: string;
}) {
  return (
    <div data-testid={testId} className={`tp-card rounded-[22px] ${pad ? 'p-[18px]' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

type ButtonVariant = 'dark' | 'ghost';
type ButtonShape = 'pill' | 'block';

/** Primary (near-black) / ghost (frosted) action. Renders <a> when href is set. */
export function ToolButton({
  variant = 'dark', shape = 'pill', full = false, href, onClick, disabled, testId, className = '', children,
}: {
  variant?: ButtonVariant; shape?: ButtonShape; full?: boolean; href?: string;
  onClick?: () => void; disabled?: boolean; testId?: string; className?: string; children: React.ReactNode;
}) {
  const skin = variant === 'dark' ? 'tp-btn-dark' : 'tp-glass tp-ink';
  const geom = shape === 'pill' ? 'rounded-full px-5 py-3' : 'rounded-2xl py-3.5 px-5';
  const cls = `${skin} ${geom} text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-transform active:scale-[0.99] ${full ? 'w-full' : ''} ${disabled ? 'opacity-40' : ''} ${className}`;
  if (href) {
    return <a href={href} data-testid={testId} className={cls}>{children}</a>;
  }
  return <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} className={cls}>{children}</button>;
}

/** Pastel-accent pill (Velix chip). `active` flips it near-black. */
export function ToolChip({
  accent, active = false, onClick, disabled, testId, children,
}: {
  accent: ToolAccent; active?: boolean; onClick?: () => void; disabled?: boolean; testId?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="text-[13px] font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-40 transition-colors"
      style={active ? { background: '#16150f', color: '#fff' } : { background: accent.accentSoft, color: accent.accent }}
    >
      {children}
    </button>
  );
}

/**
 * Velix-styled live progress for every tool page. Frosted card themed in the
 * tool's accent, narrating the real pipeline stages (server `onStage` events)
 * with a shimmering result skeleton underneath — so generation never looks
 * stalled. `labelFor` supplies the per-tool voice; falls back to one line until
 * structured events arrive.
 */
export function ToolProgress({
  stageEvents, accent, heading, fallback, labelFor,
}: {
  stageEvents: GenerationStageEvent[];
  accent: ToolAccent;
  heading: string;
  fallback: string;
  labelFor: (ev: GenerationStageEvent) => string;
}) {
  const timeline = buildStageTimeline(stageEvents, labelFor);
  const dots = (
    <span className="inline-flex gap-0.5 ml-1" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1 h-1 rounded-full animate-dot-bounce" style={{ background: accent.accent, animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );

  return (
    <div data-testid="tool-progress" className="tp-card rounded-[22px] p-[18px]">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-7 h-7 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: accent.accentSoft }}>
          <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: `${accent.accent}33`, borderTopColor: accent.accent }} />
        </span>
        <span className="text-sm font-bold tp-ink">{heading}</span>
      </div>

      {timeline.length > 0 ? (
        <ol className="flex flex-col gap-2" aria-live="polite">
          {timeline.map((item, i) => {
            const isCurrent = i === timeline.length - 1 && !item.done;
            return (
              <li key={item.key + String(i)} className="flex items-center gap-2.5 animate-fade-in">
                {item.done ? (
                  <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 animate-check-pop" style={{ background: accent.accent }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0" style={{ borderColor: `${accent.accent}33`, borderTopColor: accent.accent }} />
                )}
                <span className={`text-sm ${item.done ? 'tp-ink-3' : 'font-semibold tp-ink'}`}>{item.label}</span>
                {isCurrent && dots}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm font-semibold tp-ink-2 flex items-center" aria-live="polite">{fallback}{dots}</p>
      )}

      <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
        {['w-2/5', 'w-full', 'w-4/5'].map((width, i) => (
          <div key={i} className={`h-3 ${width} rounded-full bg-black/5 animate-pulse`} style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

/** Daily-limit modal, shared by every tool. Renders nothing when notice is null. */
export function ToolQuotaNotice({
  notice, onDismiss,
}: {
  notice: { tier: string; resetsAt: string } | null;
  onDismiss: () => void;
}) {
  if (!notice) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />
      <div data-testid="quota-notice-modal" className="relative bg-white rounded-[24px] p-6 shadow-2xl max-w-xs w-full text-center">
        <div className="text-4xl mb-2">⏳</div>
        <h3 className="font-extrabold tp-ink text-base mb-1">That's all for today</h3>
        <p className="text-sm tp-ink-2 mb-5">
          You can make more {formatResetHint(notice.resetsAt)}.
          {notice.tier === 'anonymous' && ' Sign in for a higher daily limit.'}
        </p>
        <ToolButton shape="block" full onClick={onDismiss} className="font-bold">Got it</ToolButton>
      </div>
    </div>
  );
}

/** Frosted text input / textarea with an accent focus ring. */
export function ToolInput({
  accent, multiline = false, className = '', ...props
}: {
  accent: ToolAccent; multiline?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const cls = `tp-input w-full text-sm rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 ${multiline ? 'resize-none' : ''} ${className}`;
  const style = { ['--tw-ring-color' as string]: accent.accent };
  if (multiline) {
    return <textarea {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} className={cls} style={style} />;
  }
  return <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} className={cls} style={style} />;
}
