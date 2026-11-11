# Saves feed redesign + engagement — spec and plan

Status (2026-11-11): Phases 1–7 built (thumbnails, feed API, feed screen, rich ready push + tap
tracking, "Connects to" with T = 0.80, reminders, recall + Then-and-now reviews). Phase 8 to do.
Reminders differ slightly from B0/B5 as written: the streak nudge needs a streak of 2+ days, and the
Wednesday check-in asks for one lesson when more than 3 are waiting.

## Why

Two problems with the saves feed (`app/(app)/home.tsx`):

1. **It's a wall of text.** Each card is kind label, title, one summary line. Nothing to scan, and a
   save you finished looks the same as one you never opened.
2. **Nothing brings you back after the "ready" push.** Data on 2026-11-11: 15 saves, all opened
   (39 opens), **11 lessons pre-written, 0 played**, 0 diagrams. The day-30 success test in
   [SPEC.md](../SPEC.md) needs *at least 1 lesson played a week*. Right now that one fails.

**Goal:** the feed should be quick to scan and look good, and every save should lead to a next step
(read it → play the lesson → review it later), with a few well-judged reminders.

**How we'll know it worked** (from `events` + the new `nudges` table, checked weekly):
- Lessons played a week ≥ 1. This is the success-test line; aim for 3.
- Share of saves whose lesson gets played: 0% now, aim for 30%.
- How often reminder notifications get tapped, per kind: below 15% for 2 weeks means that kind gets
  muted or reworded.

The feed may look different from the rest of the site; that's fine. It still uses the colour
tokens in `app/globals.css`, works in dark mode, and puts text on fills in `text-on-accent`.

---

## Part A — the feed

### A1. Thumbnails

**Data:** two nullable columns on `items` (an additive migration):

| Column | Type | Set by |
|---|---|---|
| `thumbnail_url` | `text` | save time (YouTube) or a new `thumbnail` job step |
| `duration_seconds` | `int` | `fetch` step (YouTube: we already read `lengthSeconds`, then throw it away) |

**By source:**

| Source | How | Network |
|---|---|---|
| YouTube Short | `https://i.ytimg.com/vi_webp/{id}/oar2.webp`: the real 1080×1920 portrait frame, ~70–100KB. The landscape thumbnails for Shorts are the vertical frame between blurred side bars | none |
| YouTube video | `https://i.ytimg.com/vi/{id}/hqdefault.jpg` (always exists; `oar2` 404s for regular videos) | none |
| Article | `og:image` / `twitter:image` from the page `<head>` (first 64KB, 6s timeout) | 1 fetch |
| TikTok | `https://www.tiktok.com/oembed?url=…` → `thumbnail_url`. **Checked 2026-11-11: oEmbed no longer returns `thumbnail_url` and the page has no `og:image`**, so TikTok saves usually get the kind tile. The attempt is kept in case it comes back | 1 fetch |

YouTube images are set in `saveItem`, so the card has its picture before the job even starts.

**Most saves are portrait.** 13 of your 15 saves are Shorts and 1 is a TikTok, so the grid (A4)
uses **4:5 portrait tiles**, and landscape images (articles, long videos) are centre-cropped into
them. The feed API reports `thumbnailShape: 'portrait' | 'landscape'` (Shorts and TikTok →
portrait) so the hero can lay out a portrait image beside its text instead of cropping it to a
strip.
| None / failed | No image. The UI draws a tile in the kind's colour with the item's top topic name | — |

**Link to the originals** (decided 2026-11-11). We store the source's own image URL and don't keep
a copy. TikTok's CDN links expire after a few days, so in Phase 3 a card whose image fails to load
falls back to the kind tile and calls `POST /api/items/<id>/thumbnail` once. That re-fetches the
oEmbed and saves the fresh URL.

**Job step:** `thumbnail` runs after `fetch` in `process-item`. It's best-effort: catch the error,
log it, and leave the column null (RULES: best-effort extras never fail the item). It's safe to
re-run: it skips if `thumbnail_url` is already set.

**Pure, testable helpers** (`lib/items/thumbnail.ts`): `youtubeThumbnail(url)`,
`parseOgImage(html, baseUrl)` (resolves relative URLs, prefers `og:image:secure_url`), and
`tiktokOembedUrl(url)`.

**Backfill:** existing YouTube saves can get their URL from the video ID. That's a **bulk update on
15 rows and needs your explicit yes** (RULES). The single TikTok save gets a re-run `thumbnail`
step from a one-off script.

**Rendering:** a plain `<img loading="lazy" decoding="async" referrerpolicy="no-referrer">` with a
fixed ratio and `object-cover`, not `next/image`, to stay off Vercel's image-optimisation quota.
Badges on the image sit on a dark scrim so they read in both themes.

### A2. Item state

Each item gets one **state**, derived on the server (pure function `feedState()` in
`lib/items/feed.ts`, unit tested):

| State | Rule | Card shows |
|---|---|---|
| `working` | status queued/processing | shimmer over thumbnail, "Watching…" / "Reading…" |
| `failed` | status failed | greyed thumbnail, "Couldn't read that one — tap to retry" |
| `new` | done, never `opened` | accent dot |
| `read` | opened, no lesson exists (recipes, or lesson not written yet) | nothing extra |
| `lesson_ready` | opened or not, an unplayed lesson exists | "Lesson ready" pill |
| `played` | `played` event exists, best `score` < 0.8 | score pill "3/5" |
| `mastered` | best score ≥ 0.8 | green check pill |

The feed API returns `FeedItem = ItemRow & { state, thumbnailUrl, durationSeconds, lessonId,
bestScore, topTopic }`. One extra query each for `events` (opened/played/score) and lesson
`item_outputs` for the page's item IDs, so no N+1.

### A3. "Up next" hero card

One big card at the top: a large thumbnail and two buttons, **Read in N min** (N = an estimate from
the explainer's length) and **Play lesson** (only when a lesson exists).

Picked by `pickUpNext(items, now)`, pure and unit tested. It takes the first match in this order:

1. Finished in the last 24h and still `new`.
2. `lesson_ready` and opened, newest first. This is the gap we measured.
3. A review that's due (see B3).
4. The oldest `new` item.
5. Nothing → no hero. Show the progress strip (A6) on its own.

A **Not now** link hides that item from the hero for 3 days. It's synced across devices in a new
`items.snoozed_until timestamptz` column, set through `POST /api/items/<id>/snooze`, and the picker
then moves to the next item.

### A4. Layout

- **Header:** "Your saves", the weekly progress strip (A6), and the settings gear stays where it is.
- **Hero** (A3).
- **Filter chips**, one row that scrolls sideways: `All` · `To read (n)` · `Lessons (n)` ·
  `Recipes` · then up to 6 topic chips. The smart chips are server filters:
  `GET /api/feed?filter=unread|lesson|recipe&topic=…`.
- **Grid:** 2 columns at phone width, 3 from `sm`. Card = 4:5 thumbnail (kind badge top-left;
  duration or ingredient count bottom-right; state pill), title clamped to 2 lines, and one meta
  line: "Lesson ready · 3h", "6 ingredients · 2d", "Mastered · 1w".
- **Paste box** → a floating **+** button bottom-right, above the tab bar. It opens a bottom sheet
  with the URL field. Most saves arrive through the share sheet, so the top of the screen goes to
  content. The `?share=` notices still show as a toast.
- **Empty states:** no saves → a big invitation to share a link from YouTube, with the + button
  highlighted. A filter with no results → "Nothing waiting. Nice." and a link back to All.
- **Load more** stays a button (infinite scroll isn't worth it at this volume).

### A5. Processing feel

- A new save shows straight away as a `working` tile. YouTube already has its thumbnail, with a
  shimmer over it and a step label from status ("Watching…", then "Writing your explainer…" once
  `raw_text` is set; that's exposed as a boolean `fetched`, not the text).
- When polling sees it change to `done`, the tile cross-fades into its finished state with the
  accent dot. Respects `prefers-reduced-motion`.
- Polling stays at 4s while anything is working, the same as today.

### A6. Streak + weekly progress

A header strip with a streak (decided 2026-11-11) and the success test's weekly targets under it:

```
🔥 6-day streak                      ❄ 1 freeze left
This week   ● ● ● ○ ○  saves on 3 of 5 days     ▶ 0 of 1 lesson
```

- **Streak:** consecutive SAST days with *a save or a lesson played*. Playing counts so the streak
  pushes you toward lessons, not only toward saving more.
- **Freeze:** one missed day a week is covered automatically, so one busy day doesn't wipe a long
  streak. That's the main thing that makes streaks feel unfair, and the main reason people give
  them up.
- **Milestones** at 3, 7, 14, 30 and 60 days: the flame changes colour, plus a one-off line under
  the strip ("A week straight — that's the habit forming").
- **Streak at risk:** after 18:00 SAST, if today has no activity and the freeze is used, the strip
  says "Save or play one thing to keep your 6-day streak". It can also be a reminder (B0).
- **Weekly progress:** days with a save Mon–Sun (`events.saved`) and lessons played
  (`events.played`). When both are met: "On track this week ✓".
- It's all computed from `events` by pure `streak(days, today)` / `weekProgress()` functions, so
  nothing new is stored. `GET /api/feed` returns `streak: { days, freezeLeft, atRisk, milestone }`
  and `week: { saveDays, lessonsPlayed }`.

---

## Part B — engagement

### B0. The nudge engine (shared by B2–B4)

Every push other than the Sunday digest goes through one place, so the volume stays sensible.

**New table `nudges`** (additive, RLS `user_id = auth.uid() AND is_allowlisted()`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | |
| `item_id` | uuid null | |
| `kind` | text check in (`ready`, `lesson`, `review`, `midweek`, `streak`) | |
| `slot` | text null | `2026-11-11T18:00` for reminders, unique per user; null for `ready` |
| `sent_at` | timestamptz | |
| `tapped_at` | timestamptz null | set when the notification is tapped |
| `action` | text null | which button was tapped (`read`, `play`, or null for the body) |

**Tap tracking:** each push's URL carries `?n=<nudgeId>`. The item and play pages call
`POST /api/nudges/<id>/tap` once and then strip the param. The service worker passes the button
that was tapped through as `&a=play`.

**You choose when** (decided 2026-11-11): Settings → Reminders picks **once or twice a day** and
the time of each, in 30-minute steps from 07:00 to 21:30 SAST. It's stored as
`users.reminder_times smallint[]` (minutes after midnight SAST), default `{1080}` (once, 18:00).
Empty array = reminders off.

**Rules** (pure `pickNudge(candidates, history, now)`, unit tested):
- **Slots:** a reminder only goes out in one of your chosen slots, one per slot. Twice a day means
  at most 2 reminders a day.
- **Ready pushes don't count:** `ready` pushes are always sent, because they answer something you
  just did.
- **Streak at risk** (`streak` kind) fills the last slot of the day when it applies and wins over
  the other kinds.
- **Back-off:** if the last 3 reminders went untapped, skip the next 2 days.
- **No repeats:** one `lesson` nudge per item ever, and one `review` per item per review step.
- **Off switch:** no slots = off. It mutes everything except `ready` and the digest.

**Runner:** an Inngest cron function `nudges` every 30 minutes from 07:00 to 21:30 SAST. For each
user whose slot is now, it builds the candidates, applies the rules, sends, and inserts the
`nudges` row. Each step is safe to re-run: insert the row first in its own step, keyed by
(user, slot date + time), then send. A unique index on that key stops a slot being sent twice.

### B1. A better "ready" push

What's sent today: *"Your explainer is ready"* / title. The new push:

- **Title:** the item title (trimmed to 60 characters).
- **Body**, chosen by kind:
  - tech: the explainer's first line + " · 2-min lesson inside"
  - recipe: "6 ingredients · 25 min — recipe card ready"
  - news/other: the explainer's first line
  - If a related save exists (B4): + "\nConnects to: *<other title>*"
- **`image`:** the thumbnail (Android shows a large picture).
- **`actions`:** `[Read]` and `[Play lesson]` for tech/news/other, `[Open recipe]` for recipes.
  Play opens `/items/<id>?play=1`, which goes to the pre-written lesson or makes one on demand.
  That way the lesson step can stay *after* notify and the push isn't delayed.
- Logged as a `nudges` row with kind `ready`, so it shows up in the tap stats.

Changes:
- `PushMessage` gains optional `image`, `actions: { action, title, url }[]`, and `tag`.
- In `public/sw.js`, `push` passes `image` and `actions` to `showNotification`, and
  `notificationclick` opens the URL for `event.action` when there is one.

### B2. "You haven't played the lesson" nudge (`lesson`)

- **Candidate:** an item that's `lesson_ready`, was opened 18h–7d ago, and was never played.
- **Copy:** title "2 minutes on *<title>*?", body "5 quick questions on what you saved yesterday.",
  action `[Play]`. The body names the lesson's template: quiz → "5 quick questions", order →
  "Put the steps in order", spot_bug → "Spot the bug", simulator → "Try it yourself".
- Opens `/play/<lessonId>?n=…`.

### B3. Resurfacing old saves (`review`) — format to be decided

Re-asking a quiz question was turned down (2026-11-11). Whatever format we pick, the schedule stays
the same: an item comes back **3, 10 and 30 days** after you last engaged with it, and the hero
card (A3, rule 3) offers it too, so it works without a push. The candidate formats:

1. **Recall card** (flashcard, self-graded, no AI call). Big thumbnail + title: "What were the key
   ideas?" Tap to flip and see the explainer's lines, then mark **Got it / Fuzzy / Forgot**. Got it
   moves it to the next step, Forgot starts again at 3 days. Takes 10 seconds, and it's the most
   proven way to remember things.
2. **Explain it back** (one Flash call). "Explain *<title>* in one line," typed or by voice. Flash
   compares your line to the explainer and replies with one line: what you got right and the bit
   you missed. Feels like a conversation, not a test.
3. **Then and now** (one Flash call, needs B4). Pairs an old save with a newer related one: "3
   weeks ago you saved X; today Y. Here's how they connect," followed by a 3-line note. You review
   by connecting ideas, not by answering questions, and the push text is more interesting.
4. **Use it** (one Flash call). A single realistic scenario, such as "Your app needs search over
   docs. Which approach from *<title>* fits, and why?", with a short answer reveal. It suits tech
   saves; recipes would get "Cook it this week?" with the ingredient list instead.

**Picked (2026-11-11): 1 + 3.** Recall card by default; Then and now for connected saves, alternating
with recall so it stays fresh. The schedule counts from the first time you opened the save; Fuzzy
repeats the same gap, Forgot restarts at 3 days, and after the 30-day card it's done. Recipes are
left out. A review card counts towards the streak.

### B4. Connections between saves

- In `process-item`, a new best-effort step `related` runs after `index`: it calls
  `similarItems(userId, itemId, 1)`, and if the best similarity is above **T** it stores
  `{ itemId, title }` in a new `items.related` jsonb column (additive).
- **T has to be measured first** on real chunks. Chunk-to-chunk similarity runs higher than the
  topic tags. Throwaway smoke test, as RULES says; don't guess.
- It's used in three places: the ready push body (B1), a "Connects to" line on the hero card, and a
  small link icon on grid cards that have a connection.

### B5. Mid-week check-in (`midweek`)

- **Wednesdays, in your last slot of the day**, only if there's something to say: lessons
  waiting ≥ 1, or saves this week = 0.
- **Copy:** "Halfway through the week" / "3 saves, 2 lessons waiting — about 4 minutes." or
  "Nothing saved yet this week — share one video today?"
- Opens `/?filter=lesson` (or `/`).
- It uses that slot instead of a lesson or review nudge, unless a streak is at risk.

### B6. Out of scope (for now)

Email reminders, home-screen badge counts (`navigator.setAppBadge`, Android support is patchy;
revisit later), sharing or social, and gamified XP or levels.

---

## Build plan

Each phase is one commit, reviewed before the next (and before any push). Every phase ends with
`npm run typecheck`, `npm test`, and `npm run build`. Phases with UI also get a check in the
browser at phone width, light and dark.

| # | Phase | Main files | Needs from you |
|---|---|---|---|
| 1 | **Thumbnail data**: migration (`items.thumbnail_url`, `duration_seconds`), `lib/items/thumbnail.ts` + tests, YouTube thumbnail at save, `duration_seconds` kept in fetch, best-effort `thumbnail` job step, `database.types.ts` | `supabase/migrations`, `lib/items/*`, `lib/jobs/process-item.ts` | OK to apply the migration; **yes to the 15-row backfill** |
| 2 | **Feed API**: migration (`items.snoozed_until`), `lib/items/feed.ts` (`feedState`, `pickUpNext`, `streak`, `weekProgress`) + tests, `GET /api/feed` with filters, snooze and thumbnail-refresh endpoints, `components/types.ts` | `lib/items`, `app/api/feed`, `app/api/items/[id]` | OK to apply the migration |
| 3 | **Feed UI**: hero, chips, 2-col grid, cards with states, image fallback and refresh, + button and sheet, working shimmer and flip, streak and progress strip, empty states | `app/(app)/home.tsx` → split into `components/feed/*` | Review screenshots |
| 4 | **Rich ready push + tracking**: `nudges` table, `PushMessage` fields, SW `image`/`actions` + bump `VERSION`, `?play=1` handling on the item page, tap endpoint | `lib/notify.ts`, `public/sw.js`, `lib/jobs/process-item.ts`, `app/api/nudges` | OK to apply the migration |
| 5 | **Connections**: migration (`items.related`), smoke-test similarity to pick T, `related` job step, show it in the push, hero and cards | `lib/jobs/process-item.ts`, `lib/items/actions.ts` | OK to apply the migration; agree on T after the measurement |
| 6 | **Nudge engine**: `lib/nudges` (`pickNudge` + tests, candidates incl. streak-at-risk), Inngest cron `nudges` (every 30 min, your slots), `users.reminder_times` + Settings picker (once/twice, times) | `lib/nudges`, `lib/jobs/nudges.ts`, `lib/jobs/functions.ts`, `app/(app)/settings` | OK to apply the migration |
| 7 | **Resurfacing**: the B3 format you pick, its page, and the review schedule in the candidates | depends on the format | **Pick a B3 format** |
| 8 | **Docs**: RULES table (`lib/nudges`, `components/feed`, new job), SPEC implementation notes, README if setup changed | `RULES.md`, `SPEC.md`, `README.md` | — |

Phases 1→2→3 are the visual win and can ship together. 4 matters most for engagement and only
depends on 1 (for the image). 5 and 6 depend on 4's `nudges` table, and 7 depends on 6. Migrations
can be combined into one if you'd rather approve once.

**Rough cost:** no new AI calls except in B3 formats 2–4 (one Flash call per review).
Everything else reuses existing outputs and embeddings.

## Decisions (2026-11-11)

- Thumbnails link to the original images; a broken TikTok image refreshes once (A1).
- Reminders: you pick once or twice a day and the times (B0).
- Streak: yes, with a weekly freeze and milestones (A6).
- "Not now" syncs across devices (A3).
- Quiz-question reviews: no. A new format is needed (B3).

## Open questions

1. **Resurfacing format:** which of the B3 options (or a mix)?
2. **Does the streak count a lesson played as activity, or only saves?** The spec counts both.
