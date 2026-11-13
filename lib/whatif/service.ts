import 'server-only';
import { generateGrounded, generateJson } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import { withUsage } from '@/lib/ai/usage';
import { HttpError } from '@/lib/http';
import { normalizeUrl } from '@/lib/items/source';
import { getPromptContext } from '@/lib/profile';
import type { WhatIfRow } from '@/lib/supabase/database.types';
import { adminClient } from '@/lib/supabase/server';
import { getSmartModel } from '@/lib/users';
import { groundedFacts, numberedFacts, type GroundedFact } from './facts';
import {
  asQuestion,
  MAX_EXTRA_WHATIFS,
  normalizeScenario,
  SCENARIO_MAX,
  whatIfDraft,
  type WhatIf,
  type WhatIfContent,
  type WhatIfDraft,
  type WhatIfSource,
} from './schema';

/**
 * What if… (docs/what-if.md, Part B). The default scenario comes from the
 * classifier; process-item writes its card in the background. Other scenarios
 * (suggested or typed on the item page) are written on request.
 *
 * Two calls per card: Search (fast tier) gathers today's facts with sources,
 * then the user's smart model writes the card and picks facts by number — so
 * the "Today" part only ever shows what Search backed.
 */

const CONTENT_CHARS = 20_000;
const FAILED = "Couldn't think this one through — try again.";

const COLUMNS = 'id, item_id, scenario, kind, status, content, error, opened_at, created_at';

function toWhatIf(row: Pick<WhatIfRow, 'id' | 'item_id' | 'scenario' | 'kind' | 'status' | 'content' | 'error' | 'opened_at' | 'created_at'>): WhatIf {
  return { ...row, content: row.content as unknown as WhatIfContent | null };
}

/** A save's what-ifs, oldest first (the main one is always first written). */
export async function listWhatIfs(userId: string, itemId: string): Promise<WhatIf[]> {
  const { data, error } = await adminClient()
    .from('whatifs')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .order('created_at');
  if (error) throw error;
  return data.map(toWhatIf);
}

/**
 * Records the classifier's scenario as the save's main what-if (pending), or
 * removes it when there's none. Safe to re-run: an unchanged scenario keeps its
 * card; a changed one starts again.
 */
export async function setMainScenario(userId: string, itemId: string, scenario: string | null): Promise<string | null> {
  const db = adminClient();
  const { data: existing, error } = await db
    .from('whatifs')
    .select('id, scenario')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .eq('kind', 'main')
    .maybeSingle();
  if (error) throw error;

  if (!scenario) {
    if (existing) {
      const { error: deleteError } = await db.from('whatifs').delete().eq('id', existing.id).eq('user_id', userId);
      if (deleteError) throw deleteError;
    }
    return null;
  }
  const text = scenario.slice(0, SCENARIO_MAX);
  if (existing) {
    if (existing.scenario !== text) {
      const { error: updateError } = await db
        .from('whatifs')
        .update({ scenario: text, status: 'pending', content: null, error: null })
        .eq('id', existing.id)
        .eq('user_id', userId);
      if (updateError) throw updateError;
    }
    return existing.id;
  }
  const { data: created, error: insertError } = await db
    .from('whatifs')
    .insert({ user_id: userId, item_id: itemId, scenario: text, kind: 'main' })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return created.id;
}

/** The save's main what-if, if it still needs writing. */
export async function pendingMainWhatIf(userId: string, itemId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from('whatifs')
    .select('id, status')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .eq('kind', 'main')
    .maybeSingle();
  if (error) throw error;
  return data && data.status !== 'done' ? data.id : null;
}

/**
 * Writes one what-if's card and saves it as done — or as failed with a
 * user-readable error. Never throws for the AI failing (the item page offers
 * Try again); only for the database.
 */
export async function writeWhatIf(userId: string, whatifId: string): Promise<WhatIf> {
  const db = adminClient();
  const { data: row, error } = await db.from('whatifs').select(COLUMNS).eq('id', whatifId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!row) throw new HttpError(404, 'What-if not found.');

  const { data: item, error: itemError } = await db
    .from('items')
    .select('title, raw_text')
    .eq('id', row.item_id)
    .eq('user_id', userId)
    .single();
  if (itemError) throw itemError;

  let fields: Partial<WhatIfRow>;
  try {
    if (!item.raw_text) throw new Error('item has no text yet');
    const content = await withUsage({ itemId: row.item_id }, () =>
      draftCard(userId, row.scenario, item.title ?? 'Untitled', item.raw_text!),
    );
    fields = { status: 'done', content: content as unknown as WhatIfRow['content'], error: null };
  } catch (err) {
    console.error('whatif: writing failed', whatifId, err);
    fields = { status: 'failed', error: FAILED };
  }
  const { data: saved, error: saveError } = await db
    .from('whatifs')
    .update(fields)
    .eq('id', whatifId)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single();
  if (saveError) throw saveError;
  return toWhatIf(saved);
}

async function draftCard(userId: string, scenario: string, title: string, text: string): Promise<WhatIfContent> {
  const [ctx, modelId] = await Promise.all([getPromptContext(userId), getSmartModel(userId)]);

  // 1. Today's facts. Best-effort: without them the card just has no "Today" part.
  let facts: GroundedFact[] = [];
  let sources: { uri: string; title: string }[] = [];
  try {
    const grounded = await generateGrounded(await prompt('whatif-facts', { scenario, title }), { feature: 'whatif', model: 'fast' });
    facts = groundedFacts(grounded.text, grounded.supports);
    sources = grounded.sources;
  } catch (err) {
    console.warn('whatif: search failed, writing without facts', err);
  }

  // 2. The card. One retry if the model's JSON doesn't fit the schema.
  const instructions = await prompt('whatif', { ...ctx, scenario, title, facts: numberedFacts(facts) });
  const parts = [{ text: instructions }, { text: `Content:\n${text.slice(0, CONTENT_CHARS)}` }];
  let draft: WhatIfDraft | undefined;
  for (let attempt = 0; attempt < 2 && !draft; attempt++) {
    try {
      draft = await generateJson(whatIfDraft, parts, { feature: 'whatif', model: 'pro', modelId });
    } catch (err) {
      if (attempt === 1) throw err;
      console.warn('whatif: draft invalid, retrying', err);
    }
  }

  const picked = [...new Set(draft!.today)].map((n) => facts[n - 1]).filter((f): f is GroundedFact => Boolean(f));
  const resolved = new Map<number, WhatIfSource>();
  await Promise.all(
    [...new Set(picked.flatMap((f) => f.sources))].map(async (i) => {
      const s = sources[i];
      if (s?.uri) resolved.set(i, { title: s.title || hostOf(s.uri), url: await resolveSource(s.uri) });
    }),
  );
  return {
    ...draft!,
    alternatives: draft!.alternatives.map(asQuestion),
    today: picked.map((f) => ({ text: f.text, sources: f.sources.flatMap((i) => (resolved.has(i) ? [resolved.get(i)!] : [])) })),
  };
}

/** Grounding links are Google redirects: follow to the real page when it answers quickly, else keep the redirect. */
async function resolveSource(uri: string): Promise<string> {
  try {
    const res = await fetch(uri, { redirect: 'follow', signal: AbortSignal.timeout(5_000) });
    await res.body?.cancel();
    return normalizeUrl(res.url || uri) ?? uri;
  } catch {
    return uri;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
}

/**
 * Another scenario on a save — one of the suggested ones or your own — written
 * now. Asking the same question again returns the card already there.
 */
export async function askWhatIf(userId: string, itemId: string, input: string): Promise<WhatIf> {
  const scenario = asQuestion(input).slice(0, SCENARIO_MAX);
  if (scenario.length < 12) throw new HttpError(400, 'Ask a bit more — e.g. “What if it flops?”');
  const existing = await listWhatIfs(userId, itemId);
  const same = existing.find((w) => normalizeScenario(w.scenario) === normalizeScenario(scenario));
  if (same?.status === 'done') return same;
  if (!same && existing.filter((w) => w.kind !== 'main').length >= MAX_EXTRA_WHATIFS) {
    throw new HttpError(429, `That's ${MAX_EXTRA_WHATIFS} extra what-ifs on this save — enough to chew on.`);
  }

  const { data: item, error: itemError } = await adminClient()
    .from('items')
    .select('status, kind')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new HttpError(404, 'Item not found.');
  if (item.status !== 'done') throw new HttpError(409, "This one isn't ready yet.");
  if (item.kind === 'recipe') throw new HttpError(400, 'Recipes have no what-ifs.');

  let id = same?.id;
  if (!id) {
    const main = existing.find((w) => w.kind === 'main');
    const suggested = main?.content?.alternatives.some((a) => normalizeScenario(a) === normalizeScenario(scenario));
    const { data, error } = await adminClient()
      .from('whatifs')
      .insert({ user_id: userId, item_id: itemId, scenario, kind: suggested ? 'alternative' : 'custom' })
      .select('id')
      .single();
    if (error) throw error;
    id = data.id;
  }
  return writeWhatIf(userId, id);
}

/** Try again on a card that failed (or never finished). */
export async function retryWhatIf(userId: string, whatifId: string): Promise<WhatIf> {
  const { data, error } = await adminClient()
    .from('whatifs')
    .update({ status: 'pending', error: null })
    .eq('id', whatifId)
    .eq('user_id', userId)
    .neq('status', 'done')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(409, 'That one is already written.');
  return writeWhatIf(userId, whatifId);
}

/** Notes the first time the full card was opened. */
export async function markWhatIfOpened(userId: string, whatifId: string): Promise<void> {
  const { error } = await adminClient()
    .from('whatifs')
    .update({ opened_at: new Date().toISOString() })
    .eq('id', whatifId)
    .eq('user_id', userId)
    .is('opened_at', null);
  if (error) throw error;
}
