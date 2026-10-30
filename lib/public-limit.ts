import 'server-only';
import { createHash } from 'node:crypto';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/http';
import { adminClient } from '@/lib/supabase/server';

/**
 * Per-visitor daily limit for public (no-login) tools. Visitors are a salted
 * hash of their IP. Returns a refund function to call if the work then fails.
 */
export async function takePublicUse(req: Request, tool: string): Promise<() => Promise<void>> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const visitor = createHash('sha256').update(`${ip}:${env().SUPABASE_SERVICE_ROLE_KEY.slice(-16)}`).digest('hex');
  const day = new Date().toISOString().slice(0, 10);
  const db = adminClient();

  const { data: allowed, error } = await db.rpc('take_public_tool_use', {
    p_visitor: visitor,
    p_tool: tool,
    p_day: day,
    p_limit: env().PUBLIC_TOOL_DAILY_LIMIT,
  });
  if (error) throw error;
  if (!allowed) throw new HttpError(429, "That's today's free limit — come back tomorrow.");

  return async () => {
    const { error: refundError } = await db.rpc('refund_public_tool_use', { p_visitor: visitor, p_tool: tool, p_day: day });
    if (refundError) console.error('refund failed', refundError);
  };
}
