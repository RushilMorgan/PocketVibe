# Trackers — spec and plan

Status (2026-11-14): **planned, nothing built.** Not yet agreed; the open decisions are at the top.

## Why

Follow any figure or ranking that someone publishes for free (a club's valuation, the Netflix global
Top 10, a share price) and see how it moves, without visiting five sites. The sites that publish these
numbers already exist (Forbes, Sportico, FlixPatrol, Netflix's own Top 10); this doesn't replace them.
What it adds is **one place, your own picks, a history, and a nudge when something changes**.

**What it is not:** our own valuations or viewership. Every reading is someone else's published figure,
shown with its source and date. Where no real number exists (a global ranking across all streamers),
the tracker says what it's a proxy for.

**How we'll know it worked** (from `events`, checked weekly for 4 weeks after Part 1 ships):
- At least 5 trackers created, and the Trackers page opened at least twice a week.
- Fewer than 1 in 10 web-lookup readings corrected or deleted by hand.
- Cost per month is known (the `tracker` line on the AI usage card) and stays inside the free searches.

If the page isn't being opened after 4 weeks, stop at Part 1 and don't build Parts 2–4. (Lessons had 11
written and 0 played; this needs the same honest check.)

## Decisions needed

| Question | Recommendation |
|---|---|
| Build order against [what-if.md](what-if.md) B–E, which is agreed but not built | One at a time. Trackers Part 1 doesn't touch the item page or lessons, so either order works; don't run both at once. |
| Where it lives | A `/trackers` page linked from a row on the Saves feed. **No sixth tab** (five is already full at phone width); promote it to a tab only if it gets used. |
| How many trackers | Cap at 20 active, so cost and noise stay bounded. |
| How often | Per tracker: daily, weekly or monthly. Default weekly. Web lookups can't be more often than daily. |
| Alerts | Changes go into the Sunday digest. A push only for trackers you mark "tell me straight away". |
| First direct feeds | Netflix global Top 10 and listed-club market caps (Part 2). |

---

## Part 1 — The tracker core, with web lookup

Anything can be tracked from day one; direct feeds come later for the things worth making exact.

### 1a. What a tracker is

A question plus a schedule: "Forbes valuation of Real Madrid", checked monthly. Two shapes:

- **Number** — one value with a unit (USD 6.6bn, 14.2m views).
- **List** — a ranked list of up to 10 names, each with an optional value (a Top 10).

Created from the Trackers page: type the question, the app runs one check straight away and shows what
it found (value, source, date) for you to confirm before it's saved. A wrong first reading means the
question needs rewording, and it's better to find that out at once than a week later.

### 1b. A check (web lookup)

Two calls, because JSON mode can't be combined with Search (the same pattern as the digest's finds in
`lib/digest/finds.ts`):

1. **Find:** `generateGrounded` (fast tier) with the question and the last reading's source. Returns
   text plus the pages Search actually read.
2. **Read:** `generateJson` (fast tier) turns that into a Zod-checked reading: value, unit, the date the
   figure is *as of*, which grounding source it came from, and the sentence it was read from. Or
   `not_found`.

Then three checks in code, all pure functions with tests:

- **Sourced:** the source must be one of Search's grounding sources, never a URL the model typed. No
  source → the reading is stored as `not_found`. A number is never guessed.
- **On the page:** fetch the source (Jina Reader, already used for saves) and look for the figure in
  the text. Found → **verified**. Page blocks bots or the figure isn't there → kept but labelled
  **unverified**.
- **Plausible:** a jump beyond a threshold against the last reading (default 30% for numbers) is stored
  as **suspect**: shown with a flag, left out of the digest, and checked again on the next run. Two
  runs that agree confirm it.

Readings are never overwritten; a correction is a new reading. You can delete a wrong one by hand.

### 1c. Schedule (job)

A new Inngest function `tracker-checks` (hourly cron, registered in `lib/jobs/functions.ts`): picks
active trackers whose `next_check_at` has passed, one step per tracker, so one failure doesn't stop the
rest. Safe to re-run: a reading is unique per tracker and period (day, week or month), so a retried
step replaces instead of adding. Three failed checks in a row pauses the tracker and says why on its
card ("Couldn't find a source since 3 Nov") — nothing fails silently.

Each step opens a usage scope for the tracker's user; calls log under a new feature **`tracker`**
(add to `FEATURES` in `lib/ai/usage-summary.ts`; `ai_usage.feature` has no CHECK, so no migration).

### 1d. The page

- `/trackers`: one card per tracker — title, latest value, change since the last reading, a small line
  chart (numbers) or the list with up/down/new marks (lists), source link, "as of" date, and the
  verified / unverified / suspect label.
- Tap a card for the full history and actions: **Check now** (limited to once a day for lookups),
  **Pause**, **Edit**, **Delete reading**, **Delete tracker**.
- An empty state with three examples to tap.
- Colour tokens, dark mode, checked at phone width. Charts follow the tokens.

### 1e. Digest

A **Your trackers** section in the Sunday digest: only trackers whose confirmed value changed that
week, with old → new and the source link. `digestContent` in `lib/digest/schema.ts` gains an optional
`trackers` array (older digests still parse).

---

## Part 2 — Direct feeds

For data that's published in a machine-readable form, skip the model: exact, free, no searches used.
Each feed is a small module in `lib/trackers/feeds/` returning the same reading shape as a lookup.

| Feed | Source | To confirm before building |
|---|---|---|
| Netflix global Top 10 (films / TV, English / non-English), weekly, with views | Netflix's Top 10 site publishes downloadable files | The file's current URL and format. Not checkable from this session (the host is blocked here). |
| Listed-club market caps (Man United, Juventus, Dortmund, Ajax, …), daily | A free quotes API | Which provider; most free ones need a key, which means a new env var in `.env.example`, README and Vercel. |

Later candidates, added only when wanted: league tables (football-data.org, free key), TMDB trending
as a cross-streamer popularity proxy (free key), crypto and exchange rates, Wikipedia pageviews.

**Not possible from free data, and the tracker will say so:** a true global ranking across Netflix,
Disney+, Prime, Max and Apple. The others publish no numbers. The closest are Netflix's official list
plus a popularity proxy, each labelled as what it is.

## Part 3 — "Track this" on a save

A button on the item page. Flash reads the save's content and offers up to 3 trackable figures it
contains ("Forbes values the club at $6.6bn"); tap one to create a tracker with the save's own figure
as the first reading and the save linked. Goes after Part 1 has proved the lookups are reliable.

## Part 4 — later

- **Straight-away pushes** for trackers marked for it (through `lib/nudges`, with tap tracking).
- **Yes/no trackers** ("Has X been announced?"). This is the same loop as what-if **Signals**
  ([what-if.md](what-if.md) Part D): a stored thing, a weekly grounded check, a line in the digest.
  Build the checking loop once here and let signals use it, instead of writing it twice.
- Trackers as context for Ask ("how has United's value moved this year?").

---

## Database changes

Additive: two new tables, both with `user_id` and the standard RLS
(`user_id = auth.uid() AND is_allowlisted()`). `Row` types added to `database.types.ts` by hand.

- **`trackers`**: title, question, shape (`number` / `list`), source (`lookup` or a feed name), feed
  settings (jsonb), unit, cadence (`daily` / `weekly` / `monthly`), push on change, status (`active` /
  `paused`), pause reason, `next_check_at`, `last_checked_at`, failures in a row, linked `item_id`
  (nullable). Indexed on (`status`, `next_check_at`).
- **`tracker_readings`**: tracker, period key, checked at, as-of date, value (numeric, nullable), list
  rows (jsonb, nullable), status (`ok` / `suspect` / `not_found`), verified (bool), source URL and
  title, the quoted sentence. Unique on (tracker, period).

**Needs an explicit yes before it's applied:** new `events` types (`tracker_create`, `tracker_open`,
`tracker_check_now`) widen the existing `events.type` CHECK, the same kind of change what-if.md
flags. If what-if ships first, do both sets of event types in one migration.

## Code layout

| Path | What |
|---|---|
| `lib/trackers/schema.ts` | Zod: tracker input, the reading (client-safe) |
| `lib/trackers/check.ts` | Pure, tested: period keys, next-check time (in the user's time zone via `lib/time.ts`), sourced / plausible rules, change between readings, list movement |
| `lib/trackers/lookup.ts` | The two-call web lookup and page verification |
| `lib/trackers/feeds/*` | Direct feeds (Part 2) |
| `lib/trackers/service.ts` | Create, list, history, run a check, pause, delete |
| `lib/jobs/tracker-checks.ts` | The hourly job |
| `app/api/trackers/**`, `components/api.ts` | Routes (`route()` wrapper) and client calls |
| `app/(app)/trackers`, `components/trackers` | Page and cards |
| `prompts/tracker-find.md`, `prompts/tracker-read.md` | The two prompts, with `VARS` entries in `lib/ai/prompts.test.ts` |

## Cost

One lookup is one grounded call plus one small Flash call. At the prices in `lib/ai/pricing.ts`,
searches are $14 per 1,000 after the 5,000 free a month. 20 weekly trackers is about 90 lookups a
month, a few hundred searches at most: inside the free allowance alongside the digest. Token cost is
Flash-sized, expected to be cents a month; the `tracker` line on the AI usage card gives the real
figure after the first week. Direct feeds cost nothing.

## Limits to be honest about

- Web-lookup readings will sometimes be wrong or stale. The three checks reduce it; they don't remove
  it. The source link and "as of" date are always on the card so a reading can be checked in one tap.
- Annual figures (Forbes, Deloitte) move once a year. Those trackers will sit flat for months; a
  monthly check is plenty.
- Fine while the app is personal and allowlisted. Opening it to other people makes showing Forbes' or
  FlixPatrol's data a licensing question to settle first.

## Build order

1. **Part 1** — tables, lookup, job, page, digest section. Tests for everything in `check.ts`; a
   throwaway smoke test of real lookups against 5 known figures (deleted, not committed).
2. One week of use. Check how many readings were wrong and what it cost.
3. **Part 2** — Netflix feed, then market caps (after confirming the sources).
4. **Part 3** — Track this.
5. The 4-week check above decides whether Part 4 happens.

Docs to update when Part 1 ships: SPEC.md (new section), RULES.md (paths table, the `tracker-checks`
job, the `tracker` feature), README and `.env.example` if a feed needs a key.
