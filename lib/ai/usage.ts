import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { adminClient } from '@/lib/supabase/server';
import { localDate } from '@/lib/time';
import { costUsd } from './pricing';
import { summarizeUsage, type Feature, type FeatureGroup, type ItemGroup, type UsageSummary } from './usage-summary';

/**
 * AI usage tracking. Every Gemini and OpenRouter call logs one `ai_usage` row:
 * tokens, searches and the estimated cost (lib/ai/pricing.ts).
 *
 * Who and which save a call is for comes from an AsyncLocalStorage scope, so
 * callers don't thread ids through every function:
 * - API routes: `route()` opens a scope and `requireUser()` fills in the user.
 * - Inngest steps: the usage middleware (lib/jobs/client.ts) opens one from
 *   the event's `userId` / `itemId`.
 * - Work on one save: `withUsage({ itemId }, …)` inside the lib function.
 * What it's for (the feature) is passed by each call site.
 *
 * Logging is best-effort: a failed insert is logged and the AI result is
 * returned as normal.
 */

export interface UsageScope {
  userId?: string;
  itemId?: string | null;
}

const scope = new AsyncLocalStorage<UsageScope>();

/** Runs `fn` with these ids added to (or replacing) the current scope's. */
export function withUsage<T>(patch: UsageScope, fn: () => T): T {
  const next: UsageScope = { ...scope.getStore() };
  if (patch.userId !== undefined) next.userId = patch.userId;
  if (patch.itemId !== undefined) next.itemId = patch.itemId;
  return scope.run(next, fn);
}

/** Records the signed-in user on the current request's scope (called by requireUser). */
export function setUsageUser(userId: string): void {
  const store = scope.getStore();
  if (store) store.userId = userId;
}

/** A copy of the current scope, for work that outlives it (a stream read after the route returns). */
export function currentUsage(): UsageScope {
  return { ...scope.getStore() };
}

export interface UsageEntry {
  feature: Feature;
  provider: 'gemini' | 'openrouter';
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  cachedTokens?: number;
  searchQueries?: number;
  /** A cost the provider reported (OpenRouter). Otherwise it's estimated from the price table. */
  costUsd?: number;
}

export async function recordUsage(entry: UsageEntry, at: UsageScope = currentUsage()): Promise<void> {
  if (!at.userId) {
    console.warn(`ai usage: ${entry.feature} call on ${entry.model} has no user, not logged`);
    return;
  }
  try {
    const cost = entry.costUsd ?? costUsd(entry.model, entry, new Date());
    const { error } = await adminClient()
      .from('ai_usage')
      .insert({
        user_id: at.userId,
        item_id: at.itemId ?? null,
        feature: entry.feature,
        provider: entry.provider,
        model: entry.model,
        input_tokens: entry.inputTokens,
        output_tokens: entry.outputTokens,
        thinking_tokens: entry.thinkingTokens ?? 0,
        cached_tokens: entry.cachedTokens ?? 0,
        search_queries: entry.searchQueries ?? 0,
        cost_usd: cost,
      });
    if (error) throw error;
  } catch (err) {
    console.error('ai usage: logging failed', entry.feature, err);
  }
}

/** Ids of rows older than this aren't needed for the card (this month and last). */
const LOOKBACK_DAYS = 63;

/** The Settings card: this month and last, by feature, the costliest saves. Months are the user's local ones. */
export async function usageReport(userId: string, timezone: string, now = new Date()): Promise<UsageSummary> {
  const db = adminClient();
  const month = localDate(now, timezone).slice(0, 7);
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const [features, items] = await Promise.all([
    db.rpc('ai_usage_by_feature', { p_user_id: userId, p_since: since, p_tz: timezone }),
    db.rpc('ai_usage_by_item', { p_user_id: userId, p_since: since, p_tz: timezone, p_month: month }),
  ]);
  if (features.error) throw features.error;
  if (items.error) throw items.error;

  const summary = summarizeUsage(month, features.data as FeatureGroup[], items.data as ItemGroup[], now);
  // Titles only for the few saves shown.
  const ids = summary.topSaves.map((s) => s.itemId);
  if (ids.length) {
    const { data, error } = await db.from('items').select('id, title').eq('user_id', userId).in('id', ids);
    if (error) throw error;
    const titles = new Map(data.map((row) => [row.id, row.title]));
    for (const save of summary.topSaves) save.title = titles.get(save.itemId) ?? null;
  }
  return summary;
}
