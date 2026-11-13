import 'server-only';
import { logEvent } from '@/lib/events';
import { HttpError } from '@/lib/http';
import { notifyUser } from '@/lib/notify';
import { adminClient } from '@/lib/supabase/server';
import { renderDigestEmail } from './email';
import { trackedPath, trackedUrl } from './links';
import { digestContent, type DigestContent } from './schema';

export interface DigestView {
  id: string;
  weekStart: string;
  content: DigestContent;
  /** Tracked same-site path for each target the page links to. */
  links: Record<string, string>;
}

function allTargets(d: DigestContent): string[] {
  return [
    ...d.groups.flatMap((g) => g.items.map((i) => `/items/${i.id}`)),
    ...d.finds.flatMap((f) => f.items.map((i) => i.url)),
    ...(d.lesson ? [`/play/${d.lesson.lessonId}`] : []),
    ...(d.whatif ? [`/items/${d.whatif.itemId}?whatif=1`] : []),
  ];
}

async function load(userId: string, digestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(digestId)) throw new HttpError(404, 'Digest not found.');
  const { data, error } = await adminClient()
    .from('digests')
    .select('id, week_start, content')
    .eq('id', digestId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Digest not found.');
  return { id: data.id, weekStart: data.week_start, content: digestContent.parse(data.content) };
}

export async function getDigest(userId: string, digestId: string): Promise<DigestView> {
  const d = await load(userId, digestId);
  return { ...d, links: Object.fromEntries(allTargets(d.content).map((to) => [to, trackedPath(d.id, to)])) };
}

/** The newest digest from the last 8 days, for the feed banner. */
export async function latestDigestId(userId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from('digests')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 8 * 86_400_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * Delivers a saved digest: web push (opens the digest page) and, when Resend
 * is configured, an email fallback. Every link is tracked.
 */
export async function deliverDigest(userId: string, digestId: string): Promise<{ pushed: number; emailed: boolean }> {
  const d = await load(userId, digestId);
  const db = adminClient();
  const { data: user, error } = await db.from('users').select('email').eq('id', userId).single();
  if (error) throw error;

  const { subject, html, text } = renderDigestEmail(d.content, (to) => trackedUrl(d.id, to));
  const pushed = await notifyUser(userId, { title: 'Your week in HeyToolie', body: subject, url: trackedPath(d.id, `/digest/${d.id}`) });
  const emailed = await sendEmail(user.email, subject, html, text);

  const { error: sentError } = await db.from('digests').update({ sent_at: new Date().toISOString() }).eq('id', d.id);
  if (sentError) throw sentError;
  return { pushed, emailed };
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('digest: RESEND_API_KEY not set, skipping email');
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'HeyToolie <hello@heytoolie.com>', to: [to], subject, html, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return true;
}

/**
 * A tracked tap: logs digest_open (with the item, when the target is one) and
 * stamps opened_at the first time. Returns where to send the visitor.
 */
export async function recordDigestTap(digestId: string, to: string): Promise<string> {
  const db = adminClient();
  const { data, error } = await db.from('digests').select('user_id, opened_at').eq('id', digestId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Digest not found.');

  const itemId = to.match(/^\/items\/([0-9a-f-]{36})$/i)?.[1];
  await logEvent(data.user_id, 'digest_open', { itemId });
  if (!data.opened_at) await db.from('digests').update({ opened_at: new Date().toISOString() }).eq('id', digestId);
  return to;
}
