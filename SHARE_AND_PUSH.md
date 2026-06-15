# Share-to-Toolie & Push Notifications

How the "share a link into Hey Toolie" flow and Web Push work, and what you must
configure to ship them.

## What's built

- **Service worker** (`src/sw.ts`, built by `vite-plugin-pwa` in injectManifest
  mode). Precaches hashed JS/CSS only (never HTML, so navigations keep hitting
  the network and respect `vercel.json`'s `must-revalidate` headers). Handles
  `push` and `notificationclick`. Auto-updates on deploy (skipWaiting + claim).
- **Web Share Target** — `share_target` in `public/manifest.json` points the OS
  share sheet at `/share`. Works on **Android** once the PWA is installed
  ("Add to Home Screen").
- **Smart routing** (`src/lib/shareRouter.ts`) — infers the best tool from the
  shared URL (YouTube / recipe sites → Recipe Extractor) and pre-selects it; the
  `/share` page (`src/components/SharePage.tsx`) lets the user override. Picking
  a tool deep-links to `/tools/<key>?shared=<url>`, where it auto-runs.
- **Push** — opt-in nudge (`src/components/PushNudge.tsx`) shown after a
  successful extraction; client subscribe in `src/lib/push.ts`; send via the
  `pocketvibe-push` edge function; subscriptions in the `push_subscriptions`
  table.

## iOS (best-effort)

Safari has no reliable Web Share Target, so "Hey Toolie" won't appear in the iOS
share sheet automatically. Two fallbacks are in place:

1. **`/share` accepts a URL deep link** — `https://<host>/share?url=<link>`. An
   iOS **Shortcut** can feed the share sheet into this:
   - Shortcuts app → **+** → add action **Get URLs from Input**.
   - Add **Open URLs**, set it to `https://<your-host>/share?url=` + the URL var.
   - In the Shortcut's settings, enable **Show in Share Sheet**, accept URLs.
   - Now "Hey Toolie" (the Shortcut) appears in Safari/YouTube share sheets.
2. **Clipboard assist** — if `/share` is opened with no payload, it reads a
   copied link from the clipboard (where permitted) and offers a paste box.

**Push on iOS** works only for **installed** PWAs on iOS 16.4+. No extra code —
the same flow applies once the user adds the app to their home screen.

## Configuration / deploy steps

1. **VAPID keys** — already generated (see `.env.local`). To regenerate:
   `npx web-push generate-vapid-keys`.
   - Client: `VITE_VAPID_PUBLIC_KEY` (public key) — in `.env.local` and Vercel.
2. **Run the migration**: `supabase db push` (creates `push_subscriptions`).
3. **Deploy the function**: `supabase functions deploy pocketvibe-push`.
4. **Set the function secrets**:
   ```
   supabase secrets set VAPID_PUBLIC_KEY=<public>
   supabase secrets set VAPID_PRIVATE_KEY=<private>
   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
   supabase secrets set PUSH_TRIGGER_SECRET=<random-long-string>
   ```
5. **Sending a push** (server-to-server, e.g. from a future "extraction done"
   hook or a cron):
   ```
   POST /functions/v1/pocketvibe-push
   x-push-secret: <PUSH_TRIGGER_SECRET>
   { "userId": "<uuid>", "title": "Your recipe is ready 🍳",
     "body": "Tap to open it.", "url": "/tools/recipe-extractor" }
   ```
   (Use `endpoint` instead of `userId` to target one device.)
