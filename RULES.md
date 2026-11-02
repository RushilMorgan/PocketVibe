# HeyToolie — Rules

What we're building lives in [SPEC.md](SPEC.md) (including where the build deliberately differs from
it). How to run it is in [README.md](README.md). This file is **how we build it** — read it before
changing code.

## Stack

- **Next.js 16** (App Router, Turbopack) on Vercel, functions in **Dublin (`dub1`)** next to the
  database. Next 16 renamed middleware to `proxy.ts`; route `params`/`searchParams` are Promises.
- **Supabase** (project `trxmbkkxfafrommyhwkl`, eu-west-1) — Auth (magic link), Postgres + pgvector,
  Storage (`diagrams` bucket), pg_cron.
- **Gemini** via `@google/genai`, two tiers (benchmarked on real saves, Nov 2026):
  - `fast` = **Gemini 3.8 Flash** (thinks low) — watching videos, recipes, classifying, picks, search.
  - `pro` = **Gemini 4 Argon** (thinks medium; lessons high, chat low) — explainers, lessons,
    diagrams, chat.
  - Each user can pick the `pro` model in Settings (`users.smart_model`, choices in
    `lib/ai/models.ts`: Argon, 3.1 Pro, 3.8 Flash); null = `GEMINI_MODEL_PRO`. Smart jobs pass it as
    `modelId` (looked up with `getSmartModel()`); the fast tier is not user-selectable.
  - `gemini-embedding-001` at 768 dims. Models are env vars (`GEMINI_MODEL_FAST/PRO`); thinking
    levels are only sent to models that support them, so a 2.5 model still works.
- **Inngest** for background jobs, served at `/api/inngest` (Vercel Marketplace integration in prod).
- **Web Push** (`web-push`, VAPID) and optional **Resend** email. **Kroki** renders Mermaid to PNG.
- **Tailwind 4**, **Zod 4**, **Vitest**. TypeScript is pinned to **6.x** — `npm i -D typescript`
  pulls 7 (the native port), which Next's build doesn't support.

## Where things live

| Path | What |
|---|---|
| `app/(app)/` | Signed-in pages with the tab bar: feed `/`, `/items/[id]`, `/ask`, `/topics`, `/settings`, `/digest/[id]` |
| `app/play/[lessonId]` | Full-screen lesson player (no tab bar) |
| `app/share`, `app/auth/callback`, `app/d/[id]` | Share target (POST), magic-link landing, signed digest-link tracker |
| `app/tools/recipe-extractor` | Standalone recipe tool at the old URL (sign-in required) |
| `app/api/**` | Route handlers: parse input → call `/lib` → JSON |
| `lib/items` | Saving links, source detection, fetching (Gemini video / Jina Reader), item actions |
| `lib/ai` | Gemini client (`generateJson`, `streamText`, `embed`, `generateGrounded`), prompt loader |
| `lib/handlers` | Recipe + explainer handlers and the client-safe output schemas |
| `lib/diagrams` | Mermaid lint → `mermaid.parse` (jsdom) → Kroki PNG → Storage |
| `lib/lessons` | Lesson schemas (quiz/simulator/order/spot_bug), template pick, generation, results |
| `lib/index`, `lib/profile.ts`, `lib/topics.ts` | Chunk + embed; interest profile (topic weights) |
| `lib/chat.ts` | "Ask" retrieval, streaming answers with citations, saved threads (`chat_messages`) |
| `lib/digest` | Weekly digest: your week, Search-grounded finds, suggested lesson, email, tracking links |
| `lib/jobs` | Inngest functions: `process-item`, `weekly-digest` (registered in `functions.ts`) |
| `components/` | Client UI; `components/lessons` has one player per template on a shared shell |
| `prompts/*.md` | Every AI prompt, editable without touching code |
| `public/sw.js` | Service worker: push, static cache, offline lessons (plain JS, no build) |
| `supabase/migrations` | Forward-only SQL; filenames match the versions recorded on the remote DB |

## Architecture rules

- All business logic lives in `/lib`. Route handlers in `app/api/**` parse input, call `/lib`, return JSON.
- Pages only talk to the backend through `components/api.ts`. Server components may call `pageUser()`
  from `lib/auth` to gate access, nothing else.
- `lib/supabase/server.ts` has two clients: `createSessionClient()` (user's session, RLS applies) and
  `adminClient()` (service role, bypasses RLS — **always filter by `user_id`**).
- Wrap route handlers in `route()` from `lib/http.ts`; throw `HttpError` for user-facing failures.
  `generateJson` never throws a `ZodError` (that would be reported as the caller's bad request).
- Every AI JSON response goes through a Zod schema (`generateJson`). Lessons are generated one
  template at a time: Flash picks the template, Pro writes JSON for just that schema.
- Nothing fails silently: a job that gives up sets `items.status = 'failed'` with a user-readable
  `error`. Best-effort extras (diagram, lesson pre-write, push) catch and log instead of failing the item.
- Chat threads are server-owned: the client sends only the new question; `lib/chat.ts` loads earlier
  turns from `chat_messages`, saves the question, and saves the answer when the stream ends (or
  whatever arrived, if it breaks). An item's thread has its `item_id`; the Ask tab's is `null`.
- Job steps must be safe to re-run (Inngest retries each step): replace outputs/chunks rather than
  append, and guard weight changes (`recordItemTopics` skips already-linked items).

## Prompts

- Loaded with `prompt(name, vars)` from `lib/ai/prompts.ts`. Context prompts get `{level}`, `{tone}`,
  `{top_topics}` from `getPromptContext()`.
- **Any `{word}` in a prompt file is a placeholder** and throws if the caller doesn't pass it. Don't
  write braces in prose (a "`%%{init}%%`" once silently disabled every diagram).
  `lib/ai/prompts.test.ts` fills each file with exactly its caller's variables — when you add a
  prompt or a variable, update its `VARS` entry.

## Data

- Every table has `user_id` and RLS `user_id = auth.uid() AND is_allowlisted()` — a signed-in account
  whose email isn't in `allowed_emails` sees nothing, even through Supabase's public API.
- Sign-up is locked by `allowed_emails` + the `hook_before_user_created` auth hook, and `lib/auth.ts`
  re-checks the allowlist on every request. Opening to strangers = disable the hook and relax the
  `is_allowlisted()` policies.
- Nothing is public: no page or API works without an allowlisted session (`robots.txt` disallows
  all). The old site's tables and functions have no `anon`/`authenticated` grants; its edge
  functions are deleted.
- Migrations are forward-only and additive. Anything destructive (drop, rename, bulk update or
  delete) needs an explicit yes first. Never reset the remote database.
- `lib/supabase/database.types.ts` is **hand-written on purpose**: `supabase gen types` types CHECK
  columns as plain `string`; ours keep the literal unions. When a migration changes a table, update
  the matching `Row` type.
- Topic matching uses cosine ≥ **0.9**, not the SPEC's 0.8 — measured on `gemini-embedding-001`,
  unrelated tags already score 0.75–0.82. Re-measure before changing the embedding model.
- Changing the embedding model or its dimensions means re-embedding every chunk and topic.

## Frontend

- Colours are tokens in `app/globals.css` (`bg`, `surface`, `ink`, `muted`, `line`, `accent`,
  `danger`, `success`, `on-accent`) with a dark-mode set. Text on accent/success/danger fills uses
  `text-on-accent`, never `text-white`.
- The service worker registers **in production only** (dev chunk URLs aren't hashed, so its
  cache-first static cache would serve stale CSS/JS). It re-checks for updates whenever the app
  becomes visible. Bump `VERSION` in `public/sw.js` when its caching changes.
- Notification `badge` and the manifest's `monochrome` icons must be white-on-transparent; Android
  renders them from the alpha channel only.

## Testing

- `npm test` (Vitest, threads pool) covers the pure logic: URL handling, chunking, schemas, shuffles,
  digest grouping/email, prompt files, retrieval helpers. Keep new pure logic in testable functions.
- Network-dependent checks (Gemini, Kroki, Search) are run as throwaway smoke tests and deleted, not
  committed.
- UI: run the app (`.claude/launch.json` has `heytoolie-dev` and `inngest-dev`) and check pages in the
  browser at phone width, light and dark.

## Deploy

- `main` auto-deploys to production on Vercel (project `pocket-vibe`). `vercel.json` pins the
  framework to Next.js, the region to `dub1`, and the Sunday digest cron.
- Set env vars from `.env.example` in Vercel. `NEXT_PUBLIC_*` is browser-visible; nothing else is.
  Changing a variable needs a redeploy.
- Production checks after a deploy: `/login` renders, `/api/cron/digest` without the secret → 401,
  `PUT /api/inngest` → "Successfully registered".
