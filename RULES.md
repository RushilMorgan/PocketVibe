# Hey Toolie — Tech Stack & Rules

> ⚠️ **WE ARE LIVE IN PRODUCTION WITH REAL CLIENT DATA.** The rules in the
> "Data Safety" section below override convenience, speed, and any other goal.
> When in doubt, stop and ask.

## 🔒 Data Safety (non-negotiable)

These rules apply to **production data** — the Supabase database (`shared_creations`,
`shared_participants`, `daily_usage`, etc.), users' localStorage creations, auth
accounts, and anything else holding real user data.

1. **Never delete or remove user data.** No `DROP TABLE`, `DROP COLUMN`,
   `TRUNCATE`, `DELETE FROM`, destructive `UPDATE`, or removing/renaming columns
   that hold data. This includes "cleanup" of rows that look unused.
2. **Never run a destructive or schema-altering migration without explicit
   approval.** New additive migrations (new tables, new nullable columns, new
   functions/indexes) are fine; anything that changes or removes existing
   columns/tables/data must be confirmed first.
3. **Stop and check with the user BEFORE doing anything that could touch, alter,
   or risk user data — even indirectly.** If a change *might* affect production
   data, describe exactly what it would do and wait for a clear "yes" before
   acting. Err on the side of asking.
4. **Prefer reversible, additive changes.** Add new fields/tables rather than
   modifying existing ones. Keep old data intact alongside new structures.
5. **Migrations are forward-only in prod.** Never roll back or reset the remote
   database. To fix a mistake, write a new additive migration.
6. **Backfills and data transforms** (any bulk write to existing rows) require
   explicit approval and, where possible, a dry-run/preview of affected rows first.

If a task seems to require any of the above, do **not** proceed silently — surface
it to the user, explain the data impact, and ask how they want to handle it.

---

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

---

## 📦 Modularity — no mega-files (mandatory)

We learned this the hard way: 1,000+ line files (`usePocketVibe.ts`,
`pocketvibe-generate/index.ts`, the big renderers) made changes slow and let a
half-registered creation type ship to production. **All new code is modular,
and big files get smaller every time they're touched — never bigger.**

### Size limits
- **New files: aim for ≤300 lines; hard stop at ~500.** If a file needs more,
  that's the signal to split it *before* writing more code.
- **Existing oversized files** (`usePocketVibe.ts`, the 1,000+ line renderers,
  `pocketvibe-generate/index.ts`): never add a new feature *into* them. Put the
  new logic in its own module and import it. Opportunistically extract when
  touching nearby code (boy-scout rule).

### How to split (the patterns already in the repo — copy these)
- **Pure logic out of components/hooks** → `src/lib/` as side-effect-free,
  unit-tested modules. Examples: `pocketVibeReducer.ts` (state machine out of
  the hook), `mergeThings.ts`, `creationSync.ts`, `recipeIcons.ts`,
  `drawEngine.ts`.
- **Pure logic out of edge functions** → a sibling dependency-free file the
  function imports (e.g. `pocketvibe-generate/pure.ts`). No Deno/npm imports in
  it, so vitest can test it directly from `src/__tests__/`.
- **Shared UI** → `src/components/shared/` (e.g. `BottomSheet.tsx`,
  `ElementChatSheet.tsx`). Never copy-paste sheet/modal/row scaffolding — if
  you're about to paste JSX from another component, extract it instead.
- **Single source of truth for cross-cutting maps** →
  `src/lib/creationTypeMeta.ts` (emoji/label/accent per type, exhaustively
  typed `Record<CreationType, …>` so the compiler flags a missing entry). Never
  re-declare per-type maps locally.
- **Big renderers**: split by section into sub-components in the same folder
  (header / list / sheet views), keeping the `content`-in, `onChange`-out
  contract at the top level.

### Registration & drift (new creation types)
- A new creation type touches many registries by design. The **drift test**
  (`src/__tests__/typeRegistry.test.ts`) fails the build until the type is
  registered in: both edge functions' `SUPPORTED_TYPES`, the system-prompt
  content formats, the client validator, `TemplateRenderer`'s switch, the
  capability registry, and `creationTypeMeta`. Keep that test green — never
  weaken it to make a build pass.
- Code-splitting is in place (`React.lazy` per renderer + per route in
  `main.tsx`). New renderers must be added as lazy chunks, not eager imports.

### DOMPurify
- Sanitise any AI-generated HTML before rendering — mandatory, never skip

---

## Template Design Standard — "AI baked into the canvas" (tap-to-talk)

**The AI is the brain; the app is the canvas.** Every template should let the user
*talk to the thing they're looking at*, not just edit a static artifact through a
separate chat. This is the standard for **all templates going forward**, and existing
templates should adopt it as they're meaningfully touched.

### The hybrid model (required for new templates)
- **Inline (tap-to-talk):** tapping any element (a card, row, score, section) summons an
  anchored sheet with **2–3 AI-chosen actions + a free-text line**. The result reshapes
  *that element only*, in place, with a brief highlight so the change is seen landing.
- **FAB (board-wide):** the floating Toolie stays for whole-tool asks ("turn this into a
  launch plan", "compare two versions"). Inline = local; FAB = global.

### The magic-vs-noise guardrail (non-negotiable)
- **AI is summoned, not always-on.** The canvas stays calm until touched.
- **One gesture, one entry point per element. ≤3 actions.** Actions are chosen from the
  element's current state so it feels like Toolie read your mind, never a generic menu.

### Architecture (reuse these — do not rebuild per template)
- **Surgical patches, never full-board regen.** Inline edits use the edge function
  `mode: 'element_edit'`, which returns only the changed/added element(s) as a small patch,
  merged deterministically by `kind` + `id` so unrelated content stays frozen. This is what
  makes it feel instant and in-place.
- **The reusable pattern** (built first on the Idea Board, generalise outward):
  - `src/lib/ideaElements.ts` — element kinds + `ElementPatch` shape (model new templates on this).
  - `src/lib/ideaElementActions.ts` — per-element contextual action engine (mirrors
    `buildIdeaBoardSuggestions` in `CreationComposer.tsx`).
  - `src/lib/applyElementPatch.ts` — pure, defensive merge (replace-by-id, scalar, clamp,
    append linked follow-ups). Never mutates input.
  - `src/components/shared/ElementChatSheet.tsx` — the anchored sheet (reuse as-is).
  - `editIdeaElement` + `buildElementEditPrompt` in `src/services/aiService.ts` — the scoped
    AI call; keep the client prompt and the edge-function prompt **in sync**.
- **Quota:** inline element edits count against the lighter **`chat`** quota, not `generation`.
- **Persistence:** apply the merged content through the renderer's existing `onChange`
  (→ `updateCreationContent`) — no new persistence path.

### Required when adding/generalising a template
1. Define the template's element kinds + patch shape (model on `ideaElements.ts`).
2. Add a per-element action engine and `applyElementPatch` cases for it.
3. Make cards tappable in **view mode only** (edit mode keeps manual controls).
4. Add the `element_edit` prompt branch for the new kinds (keep client/edge prompts in sync)
   and **deploy the edge function**.
5. Cover it with tests mirroring `src/__tests__/tapToTalk.test.tsx`.

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
- **690+ tests** covering scoring mechanics, sharing logic, auth, UI components,
  the app reducer, edge-function pure logic (incl. client/edge signature parity),
  and the creation-type drift guard (`typeRegistry.test.ts`)
- All tests must pass before merging to `main`
- Mock Supabase and external services in tests — never hit real APIs

---

## Key Conventions

- **Branch strategy:** `qa` for active work → merge to `main` for production
- **Creation types:** 14 types — the canonical list lives in
  `src/lib/creationTypeMeta.ts` (`ALL_CREATION_TYPES`); never hand-maintain type
  lists elsewhere
- **Local storage:** Creations stored in `localStorage` — tagged with `ownerUserId` when signed in, stripped on sign-out
- **Shared links:** `/s/:slug` — viewer/participant/admin access modes, 30-second auto-refresh
- **Versioning:** All shared creation updates use `expected_version` for optimistic concurrency — never overwrite without checking
- **No secrets in client bundle** — Gemini key server-side only, Supabase keys are public anon keys only
