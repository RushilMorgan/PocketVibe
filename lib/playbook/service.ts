import 'server-only';
import { withUsage } from '@/lib/ai/usage';
import { createSession } from '@/lib/council/service';
import { HttpError } from '@/lib/http';
import { getItem } from '@/lib/items/service';
import { getPromptContext } from '@/lib/profile';
import type { FrameworkRow } from '@/lib/supabase/database.types';
import { adminClient } from '@/lib/supabase/server';
import { getSmartModel } from '@/lib/users';
import { applyFrameworks, extractFrameworks, pickFrameworks } from './generate';
import { RUNS_PER_DAY, type Framework, type FrameworkContent, type FrameworkDraft, type Run, type RunContent, type RunSummary } from './schema';
import { cleanIdea, nameKey, runBrief } from './shape';

/** The Playbook's frameworks and runs. Service-role client, so every query filters by user_id. */

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const DAY_MS = 24 * 60 * 60 * 1000;
/** Names shown to the extractor, and frameworks shown to the picker: the newest this many. */
const KNOWN_NAMES = 80;
const PICK_FROM = 80;

function toFramework(row: FrameworkRow, sources: Framework['sources']): Framework {
  return { ...(row.content as unknown as FrameworkContent), id: row.id, name: row.name, createdAt: row.created_at, sources };
}

/** Adds each framework's source saves (newest link first). */
async function withSources(userId: string, rows: FrameworkRow[]): Promise<Framework[]> {
  if (!rows.length) return [];
  const db = adminClient();
  const { data: links, error } = await db
    .from('framework_items')
    .select('framework_id, item_id')
    .eq('user_id', userId)
    .in('framework_id', rows.map((r) => r.id))
    .order('created_at', { ascending: false });
  if (error) throw error;
  const itemIds = [...new Set((links ?? []).map((l) => l.item_id))];
  const titles = new Map<string, string | null>();
  if (itemIds.length) {
    const { data: items, error: itemsError } = await db.from('items').select('id, title').eq('user_id', userId).in('id', itemIds);
    if (itemsError) throw itemsError;
    for (const i of items ?? []) titles.set(i.id, i.title);
  }
  return rows.map((row) =>
    toFramework(
      row,
      (links ?? []).filter((l) => l.framework_id === row.id && titles.has(l.item_id)).map((l) => ({ itemId: l.item_id, title: titles.get(l.item_id) ?? null })),
    ),
  );
}

/** Every framework in the playbook, newest first. */
export async function listFrameworks(userId: string): Promise<Framework[]> {
  const { data, error } = await adminClient().from('frameworks').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return withSources(userId, data ?? []);
}

/** The frameworks that came from one save. */
export async function itemFrameworks(userId: string, itemId: string): Promise<Framework[]> {
  if (!isUuid(itemId)) return [];
  const db = adminClient();
  const { data: links, error } = await db.from('framework_items').select('framework_id').eq('user_id', userId).eq('item_id', itemId);
  if (error) throw error;
  if (!links?.length) return [];
  const { data, error: rowsError } = await db
    .from('frameworks')
    .select('*')
    .eq('user_id', userId)
    .in('id', links.map((l) => l.framework_id))
    .order('created_at');
  if (rowsError) throw rowsError;
  return withSources(userId, data ?? []);
}

/**
 * Files one extracted framework under the save. A framework the playbook
 * already has (same name key) is linked to this save too rather than added
 * twice; the first version's wording stays.
 */
async function keep(userId: string, itemId: string, draft: FrameworkDraft): Promise<void> {
  const db = adminClient();
  const { name, ...content } = draft;
  const name_key = nameKey(name);
  const find = () => db.from('frameworks').select('id').eq('user_id', userId).eq('name_key', name_key).maybeSingle();
  const { data: existing, error: findError } = await find();
  if (findError) throw findError;
  let id = existing?.id;
  if (!id) {
    const { data: created, error } = await db.from('frameworks').insert({ user_id: userId, name, name_key, content }).select('id').single();
    if (!error) id = created.id;
    else if (error.code !== '23505') throw error;
    else {
      // Lost a race with another save's job adding the same framework.
      const { data: raced, error: raceError } = await find();
      if (raceError || !raced) throw raceError ?? error;
      id = raced.id;
    }
  }
  const { error: linkError } = await db
    .from('framework_items')
    .upsert({ framework_id: id, item_id: itemId, user_id: userId }, { onConflict: 'framework_id,item_id', ignoreDuplicates: true });
  if (linkError) throw linkError;
}

async function extractAndKeep(userId: string, itemId: string, input: { title: string; text: string }): Promise<number> {
  const db = adminClient();
  const [{ data: known, error }, ctx, modelId] = await Promise.all([
    db.from('frameworks').select('name').eq('user_id', userId).order('created_at', { ascending: false }).limit(KNOWN_NAMES),
    getPromptContext(userId),
    getSmartModel(userId),
  ]);
  if (error) throw error;
  const drafts = await extractFrameworks({ ...input, existing: (known ?? []).map((k) => k.name), ctx, modelId });
  for (const draft of drafts) await keep(userId, itemId, draft);
  return drafts.length;
}

/**
 * Job step: pull the frameworks out of a new save. Safe to re-run — a save
 * that already has some is left alone. Returns how many it has.
 */
export async function ensureItemFrameworks(userId: string, itemId: string, input: { title: string; text: string }): Promise<number> {
  const { count, error } = await adminClient()
    .from('framework_items')
    .select('framework_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('item_id', itemId);
  if (error) throw error;
  if (count) return count;
  return extractAndKeep(userId, itemId, input);
}

/**
 * From the item page: pull frameworks out of a save that has none (an older
 * save, or one the classifier didn't flag). Returns them; [] if there's
 * nothing reusable in it.
 */
export async function pullFrameworks(userId: string, itemId: string): Promise<Framework[]> {
  const item = await getItem(userId, itemId);
  if (!item.raw_text) throw new HttpError(409, "This one hasn't been read yet.");
  if (item.kind === 'recipe') throw new HttpError(400, 'Recipes have no frameworks.');
  const existing = await itemFrameworks(userId, itemId);
  if (existing.length) return existing;
  const text = item.raw_text;
  await withUsage({ itemId }, () => extractAndKeep(userId, itemId, { title: item.title ?? item.url, text }));
  return itemFrameworks(userId, itemId);
}

/** Takes a framework out of the playbook. Runs that used it keep their text. */
export async function removeFramework(userId: string, id: string): Promise<void> {
  if (!isUuid(id)) throw new HttpError(404, 'Framework not found.');
  const { error } = await adminClient().from('frameworks').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ── Working an idea through the playbook ────────────────────────────────────

function toRun(row: { id: string; idea: string; content: unknown; created_at: string }): Run {
  return { ...(row.content as RunContent), id: row.id, idea: row.idea, createdAt: row.created_at };
}

/**
 * Works an idea through the playbook. With `frameworkIds`, exactly those are
 * used; otherwise the fast model picks up to 3 that fit, and if none do the
 * run is refused rather than forced through a framework that doesn't apply.
 */
export async function runPlaybook(userId: string, rawIdea: string, frameworkIds?: string[]): Promise<Run> {
  const idea = cleanIdea(rawIdea);
  if (!idea) throw new HttpError(400, 'Say a bit more about what you are working on.');
  const db = adminClient();
  const { count, error: countError } = await db
    .from('playbook_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - DAY_MS).toISOString());
  if (countError) throw countError;
  if ((count ?? 0) >= RUNS_PER_DAY) throw new HttpError(429, "That's today's limit. Try it again tomorrow.");

  const all = await listFrameworks(userId);
  if (!all.length) throw new HttpError(409, 'Your playbook is empty. Save something that teaches a framework first.');

  let chosen: Framework[];
  if (frameworkIds?.length) {
    chosen = all.filter((f) => frameworkIds.includes(f.id));
    if (!chosen.length) throw new HttpError(404, 'Framework not found.');
  } else {
    chosen = await pickFrameworks(idea, all.slice(0, PICK_FROM));
    if (!chosen.length) {
      throw new HttpError(422, 'Nothing in your playbook fits this one yet. Pick a framework yourself, or take it to the Council.');
    }
  }

  const [ctx, modelId] = await Promise.all([getPromptContext(userId), getSmartModel(userId)]);
  const content = await applyFrameworks({ idea, frameworks: chosen, ctx, modelId });
  const { data, error } = await db.from('playbook_runs').insert({ user_id: userId, idea, content }).select('*').single();
  if (error) throw error;
  return toRun(data);
}

export async function listRuns(userId: string): Promise<RunSummary[]> {
  const { data, error } = await adminClient()
    .from('playbook_runs')
    .select('id, idea, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const content = row.content as unknown as RunContent;
    return { id: row.id, title: content.title, idea: row.idea, frameworks: content.lenses.map((l) => l.name), createdAt: row.created_at };
  });
}

export async function getRun(userId: string, id: string): Promise<Run> {
  if (!isUuid(id)) throw new HttpError(404, 'Not found.');
  const { data, error } = await adminClient().from('playbook_runs').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Not found.');
  return toRun(data);
}

export async function deleteRun(userId: string, id: string): Promise<void> {
  if (!isUuid(id)) throw new HttpError(404, 'Not found.');
  const { error } = await adminClient().from('playbook_runs').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/** Takes a finished run to the Council (its own daily cap and cost apply). */
export async function debateRun(userId: string, id: string): Promise<{ id: string }> {
  return createSession(userId, runBrief(await getRun(userId, id)));
}
