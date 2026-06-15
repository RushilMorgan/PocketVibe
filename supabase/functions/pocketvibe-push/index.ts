// Supabase Edge Function — pocketvibe-push
// Sends a Web Push notification to a user's (or a single endpoint's) devices.
// Deploy: supabase functions deploy pocketvibe-push
// Secrets:
//   supabase secrets set VAPID_PUBLIC_KEY=...   (same value as VITE_VAPID_PUBLIC_KEY)
//   supabase secrets set VAPID_PRIVATE_KEY=...
//   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
//   supabase secrets set PUSH_TRIGGER_SECRET=...  (server-to-server auth)
//
// This is a server-to-server endpoint: callers (e.g. a future "extraction done"
// hook or a cron) must present `x-push-secret`. It is NOT meant to be hit from
// the browser with the anon key.

// @ts-nocheck — Deno runtime file; VS Code TS errors here are false positives.
// deno-lint-ignore-file
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-push-secret',
};

interface PushRequest {
  /** Target by signed-in user (all their devices)… */
  userId?: string;
  /** …or a single subscription endpoint. */
  endpoint?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const triggerSecret = Deno.env.get('PUSH_TRIGGER_SECRET');
  if (!triggerSecret || req.headers.get('x-push-secret') !== triggerSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@heytoolie.app';
  if (!vapidPublic || !vapidPrivate) return json({ error: 'vapid_not_configured' }, 500);
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  let payload: PushRequest;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!payload.title || !payload.body) return json({ error: 'title_and_body_required' }, 400);
  if (!payload.userId && !payload.endpoint) return json({ error: 'userId_or_endpoint_required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Fetch the matching subscriptions (service role bypasses RLS).
  let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth');
  query = payload.endpoint
    ? query.eq('endpoint', payload.endpoint)
    : query.eq('user_id', payload.userId);
  const { data: subs, error } = await query;
  if (error) return json({ error: 'db_error', detail: error.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0, pruned: 0 });

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag,
  });

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    (subs as SubscriptionRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification,
        );
        sent++;
      } catch (err: any) {
        // 404/410 mean the subscription is gone — prune it.
        if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(sub.endpoint);
      }
    }),
  );

  if (dead.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', dead);
  }

  return json({ sent, pruned: dead.length });
});
