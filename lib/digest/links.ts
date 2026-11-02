import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * Signed tracking links for digest buttons: /d/<digestId>?to=<target>&s=<sig>.
 * The signature lets /d log digest_open and redirect without a session (email
 * opens in a browser that may not be signed in), and stops it being used as
 * an open redirect to anywhere not in the digest.
 */
function secret(): string {
  return process.env.DIGEST_LINK_SECRET || createHash('sha256').update(`digest-links:${env().SUPABASE_SERVICE_ROLE_KEY}`).digest('hex');
}

function sign(digestId: string, to: string): string {
  return createHmac('sha256', secret()).update(`${digestId}|${to}`).digest('base64url').slice(0, 22);
}

/** Same-site path to the tracker (for in-app links and push). */
export function trackedPath(digestId: string, to: string): string {
  return `/d/${digestId}?${new URLSearchParams({ to, s: sign(digestId, to) })}`;
}

/** Absolute tracker URL (for email). */
export function trackedUrl(digestId: string, to: string): string {
  return new URL(trackedPath(digestId, to), env().NEXT_PUBLIC_SITE_URL).toString();
}

export function verifyLink(digestId: string, to: string, sig: string): boolean {
  const expected = Buffer.from(sign(digestId, to));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
