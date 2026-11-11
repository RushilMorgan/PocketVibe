/**
 * The "your save is ready" push (docs/saves-redesign.md B1). Pure, so the
 * wording is tested; lib/jobs/process-item.ts sends it.
 */
import type { PushMessage } from '@/lib/notify';
import type { ItemKind } from '@/lib/supabase/database.types';

const TITLE_MAX = 60;
const BODY_LINE_MAX = 110;

export interface ReadyInput {
  itemId: string;
  nudgeId: string;
  title: string | null;
  kind: ItemKind | null;
  /** First line of the explainer (or the recipe's description). */
  firstLine: string | null;
  ingredientCount: number | null;
  thumbnailUrl: string | null;
}

export function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Same-site URL with the nudge id and which part was tapped, for tap tracking. */
export function trackedUrl(path: string, nudgeId: string, action: 'open' | 'read' | 'play'): string {
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

  if (r.kind === 'recipe') {
    const count = r.ingredientCount ? `${r.ingredientCount} ingredients — ` : '';
    return {
      title,
      body: `${count}recipe card ready 🍳`,
      url: trackedUrl(item, r.nudgeId, 'open'),
      image: r.thumbnailUrl ?? undefined,
      actions: [{ action: 'read', title: 'Open recipe', url: trackedUrl(item, r.nudgeId, 'read') }],
    };
  }
  return {
    title,
    body: line ? `${line}\n▶ 2-min lesson inside` : 'Your explainer and a 2-min lesson are ready',
    url: trackedUrl(item, r.nudgeId, 'open'),
    image: r.thumbnailUrl ?? undefined,
    actions: [
      { action: 'read', title: 'Read', url: trackedUrl(item, r.nudgeId, 'read') },
      { action: 'play', title: '▶ Play lesson', url: trackedUrl(`${item}?play=1`, r.nudgeId, 'play') },
    ],
  };
}
