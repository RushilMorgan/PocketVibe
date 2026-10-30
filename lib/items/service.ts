import 'server-only';
import { env } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { HttpError } from '@/lib/http';
import { inngest, itemQueued } from '@/lib/jobs/client';
import { adminClient } from '@/lib/supabase/server';
import type { ItemOutputRow, ItemRow, OutputType } from '@/lib/supabase/database.types';
import { detectSource, normalizeUrl } from './source';

export type ItemWithOutputs = ItemRow & {
  outputs: ItemOutputRow[];
}

/** Midnight in South Africa (UTC+2, no DST) as an ISO timestamp. */
function startOfSastDay(now = new Date()): string {
  const sast = new Date(now.getTime() + 2 * 3600_000);
  sast.setUTCHours(0, 0, 0, 0);
  return new Date(sast.getTime() - 2 * 3600_000).toISOString();
}

/**
 * Saves a shared link and queues processing. Re-sharing a link you already
 * saved returns the existing item (re-queued if it had failed) instead of
 * creating a duplicate.
 */
export async function saveItem(userId: string, rawUrl: string): Promise<ItemRow> {
  const url = normalizeUrl(rawUrl);
  if (!url) throw new HttpError(400, "That doesn't look like a link.");
  const db = adminClient();

  const { data: existing, error: findError } = await db
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .eq('url', url)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.status === 'failed' ? retryItem(userId, existing.id) : existing;

  const { count, error: countError } = await db
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfSastDay());
  if (countError) throw countError;
  if ((count ?? 0) >= env().DAILY_ITEM_CAP) {
    throw new HttpError(429, "That's today's limit — save it again tomorrow.");
  }

  const { data: item, error } = await db
    .from('items')
    .insert({ user_id: userId, url, source: detectSource(url) })
    .select('*')
    .single();
  if (error) throw error;

  await logEvent(userId, 'saved', { itemId: item.id });
  return enqueue(item);
}

/** Puts a failed item back in the queue. */
export async function retryItem(userId: string, itemId: string): Promise<ItemRow> {
  if (!isUuid(itemId)) throw new HttpError(404, 'Item not found.');
  const { data: item, error } = await adminClient()
    .from('items')
    .update({ status: 'queued', error: null })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!item) throw new HttpError(404, 'Item not found.');
  return enqueue(item);
}

/** Sends the job event; if the queue is unreachable the item fails visibly. */
async function enqueue(item: ItemRow): Promise<ItemRow> {
  try {
    await inngest.send(itemQueued.create({ itemId: item.id, userId: item.user_id }));
    return item;
  } catch (err) {
    console.error('enqueue failed', item.id, err);
    return markFailed(item.id, "Couldn't start processing — tap Retry.");
  }
}

export async function markFailed(itemId: string, message: string): Promise<ItemRow> {
  const { data, error } = await adminClient()
    .from('items')
    .update({ status: 'failed', error: message })
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Adds an output alongside any existing ones (lessons accumulate). Returns its id. */
export async function insertOutput(
  userId: string,
  itemId: string,
  type: OutputType,
  content: ItemOutputRow['content'],
): Promise<string> {
  const { data, error } = await adminClient()
    .from('item_outputs')
    .insert({ item_id: itemId, user_id: userId, type, content })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** Stores a generated output, replacing any earlier one of the same type. */
export async function saveOutput(
  userId: string,
  itemId: string,
  type: OutputType,
  content: ItemOutputRow['content'],
  fileUrl: string | null = null,
): Promise<void> {
  const db = adminClient();
  const { error: deleteError } = await db
    .from('item_outputs')
    .delete()
    .eq('item_id', itemId)
    .eq('user_id', userId)
    .eq('type', type);
  if (deleteError) throw deleteError;
  const { error } = await db.from('item_outputs').insert({ item_id: itemId, user_id: userId, type, content, file_url: fileUrl });
  if (error) throw error;
}

export async function getItem(userId: string, itemId: string): Promise<ItemWithOutputs> {
  if (!isUuid(itemId)) throw new HttpError(404, 'Item not found.');
  const db = adminClient();
  const [{ data: item, error }, { data: outputs, error: outputsError }] = await Promise.all([
    db.from('items').select('*').eq('id', itemId).eq('user_id', userId).maybeSingle(),
    db.from('item_outputs').select('*').eq('item_id', itemId).eq('user_id', userId).order('created_at'),
  ]);
  if (error) throw error;
  if (outputsError) throw outputsError;
  if (!item) throw new HttpError(404, 'Item not found.');
  return { ...item, outputs: outputs ?? [] };
}

/** Newest first, optionally filtered to one topic. `before` is a created_at cursor. */
export async function listItems(
  userId: string,
  opts: { topicId?: string; before?: string; limit?: number } = {},
): Promise<ItemRow[]> {
  const db = adminClient();
  let query = db
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(opts.limit ?? 30, 100));

  if (opts.before) query = query.lt('created_at', opts.before);
  if (opts.topicId) {
    const { data: links, error } = await db
      .from('item_topics')
      .select('item_id')
      .eq('user_id', userId)
      .eq('topic_id', opts.topicId);
    if (error) throw error;
    query = query.in('id', (links ?? []).map((l) => l.item_id));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
