# HeyToolie

A personal web app at **[heytoolie.com](https://heytoolie.com)**. Share any article, YouTube video
or recipe link to it from the Android share sheet and get the useful version back: a clean recipe, a
plain-language explanation with a diagram, a 2-minute playable lesson, and a chat that answers from
everything you've saved. Every Sunday it sends a digest of your week plus new finds on your topics.

- **What and why:** [SPEC.md](SPEC.md) — the product spec, phases, and the day-30 success test.
- **How we build it:** [RULES.md](RULES.md) — architecture, conventions and hard-won gotchas.

## How it works

1. **Share** a link to HeyToolie (Android share sheet → `POST /share`), or paste it with the **+** button.
2. A background job (**Inngest**) fetches it — Gemini watches YouTube videos; other pages go through
   Jina Reader — then **classifies** it (recipe / tech / news / other).
3. **Recipes** become a recipe card. Everything else gets an **explainer**; tech items that explain a
   system also get a **diagram** (Mermaid → PNG).
4. The text is **chunked and embedded** (pgvector) for "Ask" and "Similar", the item's tags feed
   your **topic profile**, and it's linked to the closest other save it **connects to**.
5. You get a **push notification** with its thumbnail and Read / Play buttons, and a **lesson**
   (quiz, simulator, put-in-order or spot-the-bug) is pre-written so Play opens instantly.
6. The **saves feed** is an image grid with a streak, an **Up next** card and filters. **Reminders**
   (at the times you pick in Settings, in your phone's time zone) nudge you about a waiting lesson, a Wednesday check-in or a
   streak about to break, and **review cards** bring saves back after 3, 10 and 30 days (recall the
   key ideas, or "Then and now" for connected saves).
7. **Council** tab: describe an idea and five models from different labs (through OpenRouter)
   research it, argue it out and vote on a verdict with next steps; then ask follow-ups.
8. **Sundays 18:00 SAST** a cron builds the **weekly digest**: what you saved, 3 Search-grounded finds
   for each of your top 3 topics, and one lesson from something you never opened.

## Stack

Next.js 16 on Vercel (Dublin) · Supabase (Auth, Postgres + pgvector, Storage) · Gemini · OpenRouter (Council) · Inngest ·
Web Push · Kroki · Tailwind 4 · Zod · Vitest. Details in [RULES.md](RULES.md#stack).

## Run it locally

Needs Node 22+.

```bash
npm install
cp .env.example .env.local   # then fill it in — see the comments in the file
```

In `.env.local` also set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` and `INNGEST_DEV=1`.

Start the app and the Inngest dev server (two terminals):

```bash
npm run dev
```

```bash
npm run dev:inngest
```

Open http://localhost:3000. Sign-in is by magic link and only works for emails in the
`allowed_emails` table; add `http://localhost:3000/auth/callback` to Supabase → Auth → URL
Configuration → Redirect URLs.

To skip the email when checking pages locally, set `DEV_LOGIN_EMAIL` (an allowlisted email) in
`.env.local` and open http://localhost:3000/auth/dev?next=/. It only works under `npm run dev` on
localhost; everywhere else it's a 404.

| Script | What |
|---|---|
| `npm run dev` | Next dev server on :3000 |
| `npm run dev:inngest` | Inngest dev server on :8288, pointed at `/api/inngest` |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |

## Deploy

Pushing to `main` deploys to production on Vercel (project `pocket-vibe`). One-time setup:

1. **Vercel env vars** — everything in `.env.example` (Production). Don't set `INNGEST_DEV`.
2. **Inngest** — install the Inngest integration from the Vercel Marketplace (adds the keys, syncs
   `/api/inngest`).
3. **Supabase Auth** — Site URL `https://heytoolie.com`; Redirect URLs include
   `https://heytoolie.com/auth/callback`; Hooks → Before User Created → `hook_before_user_created`.
4. **Allowlist** — `insert into allowed_emails values ('you@example.com');`
5. **Phone** — open heytoolie.com in Chrome, sign in, *Add to Home screen*. HeyToolie then appears in
   the Android share sheet; tap 🔔 on the home screen for notifications.

Database changes go in `supabase/migrations/` (forward-only — see [RULES.md](RULES.md#data)).

## Troubleshooting

- **`fetch failed … UNABLE_TO_VERIFY_LEAF_SIGNATURE` locally** — antivirus HTTPS scanning (Norton on
  the dev machine) re-signs traffic. Node needs its CA:
  `NODE_EXTRA_CA_CERTS=C:\ProgramData\Norton\Antivirus\wscert.pem`. `.claude/launch.json` already
  sets it for the dev servers; git needs `-c http.sslBackend=schannel`.
- **Stale CSS/JS in dev** — an old service worker from before it became production-only. Unregister
  it in DevTools → Application → Service Workers.
- **No push notifications** — check the device subscribed (`push_devices` table) and the Vercel logs
  for `notify:`. A 403 "VAPID credentials … do not correspond" means the browser subscribed with an
  old key; reopening the app re-subscribes it.
- **No reminders** — check `users.reminder_times` isn't empty and `users.timezone` is right (it follows the phone), the `nudges` table for the slot
  (`slot` like `2026-11-11T18:00`; three untapped in a row pause them for two days), and that the
  `reminders` function is synced in Inngest (`PUT /api/inngest`).
- **Shares stuck on "working on it…"** — Inngest isn't reachable: locally run `npm run dev:inngest`
  with `INNGEST_DEV=1`; in production check the integration and `PUT /api/inngest`.
