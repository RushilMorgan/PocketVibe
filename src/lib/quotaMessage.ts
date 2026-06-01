/**
 * Friendly, user-facing copy for daily-limit situations.
 * Keeps wording in one place so the chat thread, banners, and nudges stay
 * consistent. Anonymous users get a sign-in nudge (more allowance when signed
 * in); signed-in users just get the reset time.
 */
import type { UsageKind, UsageTier } from './usageStore';

/** Turn an ISO reset timestamp into a short human hint like "in about 5 hours". */
export function formatResetHint(resetsAt: string): string {
  if (!resetsAt) return 'tomorrow';
  const reset = new Date(resetsAt).getTime();
  if (Number.isNaN(reset)) return 'tomorrow';
  const diffMs = reset - Date.now();
  if (diffMs <= 0) return 'shortly';
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'in less than an hour';
  if (hours === 1) return 'in about an hour';
  if (hours < 24) return `in about ${hours} hours`;
  return 'tomorrow';
}

export interface QuotaMessageInput {
  kind: UsageKind;
  tier: UsageTier;
  resetsAt: string;
  /** True when the app could offer a sign-in upgrade (auth available + not signed in). */
  canSignIn?: boolean;
}

/** Full chat-thread message shown when a limit is hit. */
export function formatQuotaMessage({ kind, tier, resetsAt, canSignIn }: QuotaMessageInput): string {
  const noun = kind === 'chat' ? 'questions' : 'creations';
  const resetHint = formatResetHint(resetsAt);

  if (tier === 'anonymous' && canSignIn) {
    return `You've used all your free ${noun} for today. Sign in for a higher daily limit — or come back ${resetHint} when it resets. 🙌`;
  }
  return `You've reached today's limit of ${noun}. It resets ${resetHint}. Thanks for using Hey Toolie! ✨`;
}

/** Short label for inline "X left today" hints. */
export function formatRemainingLabel(kind: UsageKind, remaining: number): string {
  const noun = kind === 'chat' ? (remaining === 1 ? 'question' : 'questions') : (remaining === 1 ? 'creation' : 'creations');
  return `${remaining} ${noun} left today`;
}
