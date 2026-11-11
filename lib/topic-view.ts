/**
 * The Topics page, worked out from plain rows (pure, client-safe, tested).
 * lib/topics.ts loads the rows and asks the fast model for theme names.
 */
import type { ItemKind } from '@/lib/supabase/database.types';

/** How many topics feed into prompts as "what this user is into". */
export const TOP_N = 5;
const DAY_MS = 24 * 3600_000;
const NEW_DAYS = 7;
const FADING_DAYS = 14;

export interface TopicSave {
  id: string;
  title: string | null;
  url: string;
  kind: ItemKind | null;
  thumbnail_url: string | null;
}

export interface TopicView {
  id: string;
  name: string;
  weight: number;
  itemCount: number;
  lastSeenAt: string;
  createdAt: string;
  /** Up to 4 newest saves under it, for the thumbnail collage. */
  saves: TopicSave[];
  /** 'new' = first seen this week; 'fading' = nothing new in two weeks. */
  trend: 'new' | 'fading' | null;
  /** In the top 5 that shape every explanation. */
  top: boolean;
}

export interface Theme {
  name: string;
  emoji: string;
  topicIds: string[];
}

export interface TopicThemesCache {
  hash: string;
  themes: Theme[];
}

export interface KindShare {
  kind: ItemKind;
  count: number;
  percent: number;
}

export function topicTrend(t: { createdAt: string; lastSeenAt: string }, now: Date): TopicView['trend'] {
  const age = now.getTime() - Date.parse(t.createdAt);
  if (age <= NEW_DAYS * DAY_MS) return 'new';
  if (now.getTime() - Date.parse(t.lastSeenAt) >= FADING_DAYS * DAY_MS) return 'fading';
  return null;
}

/** Changes whenever a topic is added, renamed, merged or forgotten, so themes are regenerated. */
export function themesHash(topics: { id: string; name: string }[]): string {
  return topics
    .map((t) => `${t.id}:${t.name}`)
    .sort()
    .join('|');
}

/**
 * Turns the model's grouping (by topic name) into ids. Every topic ends up in
 * exactly one theme: names it repeated are kept once, names it dropped or
 * invented are fixed up, and leftovers go to "Everything else". Empty themes
 * are removed.
 */
export function assignThemes(
  topics: { id: string; name: string }[],
  grouped: { name: string; emoji: string; topics: string[] }[],
): Theme[] {
  const byName = new Map(topics.map((t) => [t.name.trim().toLowerCase(), t.id]));
  const used = new Set<string>();
  const themes: Theme[] = [];
  for (const g of grouped) {
    const ids: string[] = [];
    for (const name of g.topics) {
      const id = byName.get(name.trim().toLowerCase());
      if (id && !used.has(id)) {
        used.add(id);
        ids.push(id);
      }
    }
    if (ids.length) themes.push({ name: g.name.trim(), emoji: g.emoji.trim() || '•', topicIds: ids });
  }
  const rest = topics.filter((t) => !used.has(t.id)).map((t) => t.id);
  if (rest.length) themes.push({ name: 'Everything else', emoji: '🧩', topicIds: rest });
  return themes;
}

/** What you save, by kind, biggest first. */
export function kindMix(kinds: (ItemKind | null)[]): KindShare[] {
  const counts = new Map<ItemKind, number>();
  for (const k of kinds) if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count, percent: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

/** Words that shouldn't be title-cased the usual way. */
const SPECIAL: Record<string, string> = {
  ai: 'AI',
  saas: 'SaaS',
  chatgpt: 'ChatGPT',
  gpt: 'GPT',
  kdp: 'KDP',
  llm: 'LLM',
  llms: 'LLMs',
  api: 'API',
  apis: 'APIs',
  seo: 'SEO',
  ui: 'UI',
  ux: 'UX',
  devops: 'DevOps',
  iot: 'IoT',
  vr: 'VR',
  ar: 'AR',
  nft: 'NFT',
  nfts: 'NFTs',
  diy: 'DIY',
  usa: 'USA',
  uk: 'UK',
  macos: 'macOS',
  ios: 'iOS',
  iphone: 'iPhone',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  github: 'GitHub',
};
const SMALL = new Set(['and', 'or', 'of', 'the', 'in', 'on', 'for', 'to', 'a', 'an', 'vs']);

/** "local ai" → "Local AI", "chatgpt" → "ChatGPT", "the fourth turning" → "The Fourth Turning". */
export function displayTopic(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (SPECIAL[lower]) return SPECIAL[lower];
      if (i > 0 && SMALL.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}
