/**
 * Single source of truth for per-creation-type metadata (emoji, label, accent).
 *
 * The maps are typed Record<CreationType, …> on purpose: adding a type to the
 * union breaks the build here until every map has an entry. ALL_CREATION_TYPES
 * exposes the same list at runtime so the drift test can assert the edge
 * functions / validator / renderer stay in sync too.
 */
import type { CreationType } from '../types';
import { TEMPLATE_IDENTITIES } from './templateIdentity';

/**
 * Emoji / label / accent per type are DERIVED from the single identity source
 * (`templateIdentity.ts`) so the list, header, hero and canvas can never drift
 * apart again. To change a type's look, edit TEMPLATE_IDENTITIES — not here.
 */
const IDENTITY_ENTRIES = Object.entries(TEMPLATE_IDENTITIES) as Array<
  [CreationType, (typeof TEMPLATE_IDENTITIES)[CreationType]]
>;

export const TYPE_EMOJI = Object.fromEntries(
  IDENTITY_ENTRIES.map(([type, id]) => [type, id.emoji]),
) as Record<CreationType, string>;

export const TYPE_LABEL = Object.fromEntries(
  IDENTITY_ENTRIES.map(([type, id]) => [type, id.label]),
) as Record<CreationType, string>;

export const TYPE_ACCENT = Object.fromEntries(
  IDENTITY_ENTRIES.map(([type, id]) => [type, id.accent]),
) as Record<CreationType, string>;

/** Every creation type, from the exhaustively-typed identity source. */
export const ALL_CREATION_TYPES = Object.keys(TEMPLATE_IDENTITIES) as CreationType[];

/** String-friendly lookups (cloud rows store creation_type as plain text). */
export function typeEmoji(type: string): string {
  return TYPE_EMOJI[type as CreationType] ?? '🔧';
}
export function typeLabel(type: string): string {
  return TYPE_LABEL[type as CreationType] ?? 'Tool';
}

export function timeAgo(ms: number): string {
  if (!ms) return '';
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

/** Exact, human date+time — used to tell apart same-named tools. */
export function exactDate(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
