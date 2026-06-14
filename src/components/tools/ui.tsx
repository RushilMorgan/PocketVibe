import React from 'react';
import type { ToolAccent } from '../../lib/toolPages';

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
