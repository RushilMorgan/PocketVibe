import 'server-only';
import { councilEnv } from '@/lib/env';
import { HttpError } from '@/lib/http';
import { councilFollowupQueued, councilQueued, inngest } from '@/lib/jobs/client';
import type { CouncilSessionRow } from '@/lib/supabase/database.types';
import { adminClient } from '@/lib/supabase/server';
import { roster } from './run';
import { SEATS } from './roster';
import type { CouncilSessionView, CouncilSummary, CouncilTurn, Report } from './schemas';

/** The Council's sessions and turns. Service-role client, so every query filters by user_id. */

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const DAY_MS = 24 * 60 * 60 * 1000;

export async function listSessions(userId: string): Promise<CouncilSummary[]> {
  const { data, error } = await adminClient()
    .from('council_sessions')
    .select('id, title, idea, status, stage, report, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((s) => {
    const report = s.report as unknown as Report | null;
    return {
      id: s.id,
      title: s.title,
      idea: s.idea,
      status: s.status,
      stage: s.stage,
      verdict: report?.verdict ?? null,
      headline: report?.headline ?? null,
      createdAt: s.created_at,
    };
  });
}

async function getRow(userId: string, id: string): Promise<CouncilSessionRow> {
  if (!isUuid(id)) throw new HttpError(404, 'Session not found.');
  const { data, error } = await adminClient().from('council_sessions').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Session not found.');
  return data;
}

export async function getSession(userId: string, id: string): Promise<CouncilSessionView> {
  const row = await getRow(userId, id);
  const { data: turns, error } = await adminClient()
    .from('council_turns')
    .select('round, stage, member, model, content, cost_usd, created_at')
    .eq('session_id', id)
    .eq('user_id', userId)
    .order('round')
    .order('created_at');
  if (error) throw error;
  const seats = roster();
  return {
    id: row.id,
    idea: row.idea,
    title: row.title,
    status: row.status,
    stage: row.stage,
    error: row.error,
    report: row.report as unknown as Report | null,
    createdAt: row.created_at,
    costUsd: (turns ?? []).reduce((sum, t) => sum + Number(t.cost_usd), 0),
    seats: SEATS.map((seat) => ({ seat, label: seats[seat].label, model: seats[seat].model })),
    turns: (turns ?? []).map((t) => ({
      round: t.round,
      stage: t.stage,
      member: t.member as CouncilTurn['member'],
      model: t.model,
      content: t.content,
      createdAt: t.created_at,
    })),
  };
}

export async function createSession(userId: string, idea: string): Promise<{ id: string }> {
  const db = adminClient();
  const { count, error: countError } = await db
    .from('council_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - DAY_MS).toISOString());
  if (countError) throw countError;
  if ((count ?? 0) >= councilEnv().COUNCIL_DAILY_CAP) {
    throw new HttpError(429, "That's the council's limit for today — try again tomorrow.");
  }

  const { data, error } = await db.from('council_sessions').insert({ user_id: userId, idea }).select('id').single();
  if (error) throw error;
  await enqueue(userId, data.id);
  return { id: data.id };
}

/** Runs a failed session again; stages that already finished are reused, not re-billed. */
export async function retrySession(userId: string, id: string): Promise<void> {
  const row = await getRow(userId, id);
  if (row.status !== 'failed') throw new HttpError(409, 'Only a failed session can be retried.');
  await setStatus(userId, id, { status: 'queued', error: null });
  await enqueue(userId, id);
}

export async function askFollowup(userId: string, id: string, question: string): Promise<void> {
  const row = await getRow(userId, id);
  if (!row.report) throw new HttpError(409, 'The council has to finish its report first.');
  if (row.status === 'queued' || row.status === 'running') throw new HttpError(409, 'The council is still working — wait for it to finish.');

  const db = adminClient();
  const { data: last, error } = await db
    .from('council_turns')
    .select('round')
    .eq('session_id', id)
    .eq('user_id', userId)
    .order('round', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const round = (last?.round ?? 0) + 1;

  const { error: insertError } = await db
    .from('council_turns')
    .insert({ session_id: id, user_id: userId, round, stage: 'question', member: 'you', model: '', content: { question } });
  if (insertError) throw insertError;
  await setStatus(userId, id, { status: 'queued', stage: 'followup', error: null });
  try {
    await inngest.send(councilFollowupQueued.create({ sessionId: id, userId, round, question }));
  } catch (err) {
    console.error('council follow-up enqueue failed', id, err);
    await setStatus(userId, id, { status: 'done', stage: 'done', error: "Couldn't send that follow-up — ask again." });
  }
}

export async function deleteSession(userId: string, id: string): Promise<void> {
  if (!isUuid(id)) throw new HttpError(404, 'Session not found.');
  const { error } = await adminClient().from('council_sessions').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function setStatus(userId: string, id: string, fields: Partial<CouncilSessionRow>): Promise<void> {
  const { error } = await adminClient().from('council_sessions').update(fields).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

async function enqueue(userId: string, id: string): Promise<void> {
  try {
    await inngest.send(councilQueued.create({ sessionId: id, userId }));
  } catch (err) {
    console.error('council enqueue failed', id, err);
    await setStatus(userId, id, { status: 'failed', error: "Couldn't start the council — tap Retry." });
  }
}
