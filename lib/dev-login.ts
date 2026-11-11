/**
 * Local-only sign-in for checking pages in the browser without a magic-link
 * email (`/auth/dev`). Pure guard so it's tested: it only ever passes in
 * `next dev`, on a localhost host, with DEV_LOGIN_EMAIL set in .env.local.
 * Vercel always runs with NODE_ENV=production, so it can't pass there.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function devLoginEmail(nodeEnv: string | undefined, hostname: string, email: string | undefined): string | null {
  if (nodeEnv !== 'development') return null;
  if (!LOCAL_HOSTS.has(hostname) && !hostname.endsWith('.localhost')) return null;
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}
