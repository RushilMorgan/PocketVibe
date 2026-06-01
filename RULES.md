# Hey Toolie — Tech Stack & Rules

## Hosting & Deployment

### Vercel
- **Production** auto-deploys from `main` branch on every push
- **QA / staging** work is done on the `qa` branch — merge to `main` only when ready to go live
- SPA routing handled via `vercel.json` rewrite: all paths serve `index.html`
- Shared tool pages route as `/s/:slug` client-side

---

## Frontend

### React 19 + TypeScript
- Strict TypeScript (`~6.0.2`) — no `any` shortcuts, all types explicit
- Functional components and hooks only
- File structure: `src/components/`, `src/hooks/`, `src/lib/`, `src/services/`, `src/types/`

### Vite 8
- Dev server: `npm run dev`
- Production build: `npm run build` (runs `tsc` first, then Vite)

### Tailwind CSS v4
- Utility-first styling via `@tailwindcss/vite` plugin
- **Design system — two tiers:**
  - **Dark chrome** (`gray-950` / `gray-900` + violet/yellow accents) — Toolie AI UI, shared page headers, FAB
  - **Light canvas** (white / `gray-50`) — tool content rendered inside the app

### Lucide React
- Icon library — use existing icons before adding new ones

### DOMPurify
- Sanitise any AI-generated HTML before rendering — mandatory, never skip

---

## Backend & Data

### Supabase
- **Auth** — Google OAuth (primary), email magic link, email+password
  - Apple OAuth configured but hidden in UI until fully set up
  - Row-level security (RLS) enforced on all tables
- **Database** — PostgreSQL via Supabase
  - `shared_creations` — shared tool records, versioned, admin-token protected
  - `world_cup_teams` + `world_cup_matches` — canonical WC 2026 data
- **Edge Functions** (Deno, in `supabase/functions/`)
  - `pocketvibe-generate` — AI generation pipeline (proxies Gemini, keeps API key server-side)
  - `create-shared-creation` — creates a share record, returns slug + admin token
  - `get-shared-creation` — fetches a share by slug with access-mode resolution
  - `update-shared-creation` — versioned PATCH (optimistic concurrency via `expected_version`)
  - `apply-creation-action` — approve/decline change requests, lock draws, etc.
  - `create-participant-link` — generates participant tokens for shared tools
  - `sync-world-cup-results` — syncs canonical WC match results into the DB
- **Environment variables** (set in Vercel + local `.env.local`)
  - `VITE_SUPABASE_URL` — public, safe in browser bundle
  - `VITE_SUPABASE_ANON_KEY` — public anon key, safe in browser bundle
  - `VITE_GEMINI_API_KEY` — **DEV only**, never in production builds

### Google Gemini AI (`@google/generative-ai`)
- In production: Gemini is called via the `pocketvibe-generate` Edge Function (API key stays server-side)
- In local dev: can call Gemini directly if `VITE_GEMINI_API_KEY` is set
- Never expose the Gemini API key in client-side production code

---

## Analytics

### PostHog
- **Region: US Cloud** (`https://us.i.posthog.com`)
- Project token stored in `src/lib/analytics.ts`
- Autocapture enabled (clicks, page views, session recordings)
- Admin/participant tokens are stripped from `$current_url` before sending
- **Events tracked:** `creation_started`, `creation_completed`, `creation_improved`, `world_cup_pool_created`, `creation_deleted`, `share_panel_opened`, `share_link_created`, `shared_page_viewed`, `remix_clicked`, `sign_in`, `sign_out`
- Events are **suppressed in dev** (`import.meta.env.DEV`) to keep analytics clean
- All PostHog calls go through `src/lib/analytics.ts` — never import `posthog-js` directly elsewhere

---

## Testing

### Vitest + Testing Library
- Run: `npm test` (single run) or `npm run test:watch`
- Coverage: `npm run test:coverage`
- Tests live in `src/__tests__/`
- **462+ tests** covering scoring mechanics, sharing logic, auth, and UI components
- All tests must pass before merging to `main`
- Mock Supabase and external services in tests — never hit real APIs

---

## Key Conventions

- **Branch strategy:** `qa` for active work → merge to `main` for production
- **Creation types:** `tournament_pool_tracker`, `workout_tracker` (more coming)
- **Local storage:** Creations stored in `localStorage` — tagged with `ownerUserId` when signed in, stripped on sign-out
- **Shared links:** `/s/:slug` — viewer/participant/admin access modes, 30-second auto-refresh
- **Versioning:** All shared creation updates use `expected_version` for optimistic concurrency — never overwrite without checking
- **No secrets in client bundle** — Gemini key server-side only, Supabase keys are public anon keys only
