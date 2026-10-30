# HeyToolie — Rules

What we're building lives in [SPEC.md](SPEC.md). This file is how we build it.

## Stack

- **Next.js 16** (App Router, Turbopack) on Vercel — site and API in one codebase.
  Next 16 renamed middleware to `proxy.ts`; route `params`/`searchParams` are Promises.
- **Supabase** — Auth (magic link), Postgres + pgvector, Storage. Migrations in `supabase/migrations/`.
- **Gemini** via `@google/genai` — Flash by default, Pro for lessons, `gemini-embedding-001` at 768 dims.
- **Inngest** for background jobs (`/api/inngest`). Run `npm run dev:inngest` next to `npm run dev`.
- **Tailwind 4**, **Zod 4**, **Vitest**. TypeScript is pinned to 6.x (Next's build uses the TS API).

## Architecture

- All business logic lives in `/lib`. Route handlers in `app/api/**` parse input, call `/lib`, return JSON.
- Pages only call the API (via `components/api.ts`). Server components may call `lib/auth` to gate
  access, nothing else.
- `lib/supabase/server.ts` has two clients: `createSessionClient()` (user's session, RLS applies) and
  `adminClient()` (service role, bypasses RLS — **always filter by `user_id`**).
- Wrap route handlers in `route()` from `lib/http.ts`; throw `HttpError` for user-facing failures.
- Prompts live in `/prompts/*.md` and are loaded with `prompt(name, vars)`. Every prompt can use
  `{level}`, `{tone}`, `{top_topics}` (from `lib/profile.ts`). Unknown placeholders throw.
- Every AI JSON response goes through a Zod schema (`generateJson`).
- Nothing fails silently: a job that gives up sets `items.status = 'failed'` with a user-readable `error`.

## Data

- Every table has `user_id` and RLS `user_id = auth.uid()`.
- Sign-up is locked by `allowed_emails` + the `hook_before_user_created` auth hook, and `lib/auth.ts`
  re-checks the allowlist on every request.
- Migrations are forward-only and additive. Anything destructive (drop, rename, bulk update) needs an
  explicit yes first. Never reset the remote database.
- After a migration is applied, regenerate types:
  `npx supabase gen types typescript --linked > lib/supabase/database.types.ts`

## Deploy

- `main` auto-deploys to production on Vercel. Work on a branch; merge when it's ready to ship.
- Set env vars from `.env.example` in Vercel. `NEXT_PUBLIC_*` is browser-visible; nothing else is.
