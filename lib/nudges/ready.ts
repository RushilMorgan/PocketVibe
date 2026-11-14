/**
 * The "your save is ready" push (docs/saves-redesign.md B1; buttons from docs/what-if.md Part C). Pure, so the
 * wording is tested; lib/jobs/process-item.ts sends it.
 */
import type { PushMessage } from '@/lib/notify';
import type { ItemKind, NudgeAction } from '@/lib/supabase/database.types';

const TITLE_MAX = 60;
const BODY_LINE_MAX = 110;
const RELATED_MAX = 50;
const WHATIF_MAX = 90;

export interface ReadyInput {
  itemId: string;
  nudgeId: string;
  title: string | null;
  kind: ItemKind | null;
  /** First line of the explainer (or the recipe's description). */
  firstLine: string | null;
  ingredientCount: number | null;
  thumbnailUrl: string | null;
  /** Title of the save this one connects to (lib/items/related.ts), if any. */
  relatedTitle?: string | null;
  /** The what-if scenario, when its card was written; adds the What if button. */
  whatIf?: string | null;
}

export function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Same-site URL with the nudge id and which part was tapped, for tap tracking. */
export function trackedUrl(path: string, nudgeId: string, action: NudgeAction): string {
  const [base, query] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('n', nudgeId);
  params.set('a', action);
  return `${base}?${params}`;
}

export function readyMessage(r: ReadyInput): PushMessage {
  const item = `/items/${r.itemId}`;
  const title = r.title ? clip(r.title, TITLE_MAX) : 'Your save is ready';
  const line = r.firstLine ? clip(r.firstLine, BODY_LINE_MAX) : null;
  const connects = r.relatedTitle ? `\n🔗 Connects to: ${clip(r.relatedTitle, RELATED_MAX)}` : '';

  if (r.kind === 'recipe') {
    const count = r.ingredientCount ? `${r.ingredientCount} ingredients — ` : '';
    return {
      title,
      body: `${count}recipe card ready 🍳${connects}`,
      url: trackedUrl(item, r.nudgeId, 'open'),
      image: r.thumbnailUrl ?? undefined,
      actions: [{ action: 'read', title: 'Open recipe', url: trackedUrl(item, r.nudgeId, 'read') }],
    };
  }
  // Read only when there's no what-if; with one, a second button deep-links to its card.
  const whatIf = r.whatIf ? `\n💭 ${clip(r.whatIf, WHATIF_MAX)}` : '';
  return {
    title,
    body: (line ?? 'Your explainer is ready') + whatIf + connects,
    url: trackedUrl(item, r.nudgeId, 'open'),
    image: r.thumbnailUrl ?? undefined,
    actions: [
      { action: 'read', title: 'Read', url: trackedUrl(item, r.nudgeId, 'read') },
      ...(r.whatIf ? [{ action: 'whatif', title: '💭 What if', url: trackedUrl(`${item}?whatif=1`, r.nudgeId, 'whatif') }] : []),
    ],
  };
}
