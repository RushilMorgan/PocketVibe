# What if… + AI usage tracking — spec and plan

Status (2026-11-13): **Part A (usage tracking) built**, not yet deployed; B–E planned.
Part A as built: no budget alert yet (left for later), and the card shows Google searches separately
because the 5,000 free a month are per Google account. Gemini prices were copied on 2026-11-13; Argon's
launch price doubles on 1 Dec 2026 and 3.8 Flash's on 1 Jan 2027, so the table is dated.

## Why

Lessons aren't working. On 2026-11-11 there were 11 lessons pre-written and 0 played (see
[saves-redesign.md](saves-redesign.md)), and the quiz format isn't liked. Lessons move out of the way
(Part C) and a **What if…** card takes their place: a grounded, honest look at what happens if the
thing in the save plays out at scale, ending in **signals to watch** that the app can later spot for you.

AI spend is tracked from the start (Part A) so we know what this costs, per feature and per save.

**How we'll know it worked** (from `events` and `ai_usage`, checked weekly for 2 weeks):
- A what-if gets opened on at least half of the saves that have one.
- The other scenarios or "Your own what-if" get used at least once a week.
- Cost per what-if is known and a long way below the cost of the explainer it sits under.

The day-30 line in [SPEC.md](../SPEC.md) "played at least 1 lesson a week" becomes "opened a
what-if on at least half of eligible saves". Update SPEC.md's "where the build differs" when this ships.

## Decisions (agreed 2026-11-12)

| Question | Decision |
|---|---|
| Which saves get one | `news` and `tech`; `other` only when Flash finds a sensible scenario. Never recipes. |
| The lesson games | All four (quiz, simulator, order, spot-the-bug) move behind Tools, made only on request. No pre-writing. |
| Local angle | None. What-ifs are global; the user can ask about their own country in the item's chat. |
| When it's written | On every eligible save, in the background, so it's ready on open. |
| Cost | Track every AI call's usage and estimated cost (Part A). |

---

## Part A — AI usage tracking (build first)

Built before the what-if so there's a baseline to compare against.

**What's recorded, per AI call:** time, user, feature (`classify`, `explainer`, `recipe`, `diagram`,
`whatif`, `whatif_search`, `chat`, `digest`, `council`, `embed`, `lesson`, …), item (if any),
provider (`gemini` / `openrouter`), model id, input tokens, output tokens, thinking tokens,
cached tokens, search queries used, and cost in USD.

**Where it comes from:**
- Gemini: every response carries usage metadata (prompt, candidates, thoughts, tool-use and cached
  token counts); grounded calls also list the search queries they ran; a stream reports usage on its
  last chunk. Captured once in `lib/ai/gemini.ts`, so every caller is covered. Callers pass a
  `feature` tag; an untagged call is logged as `other` (so a missed tag shows up instead of vanishing).
- Embeddings: the API doesn't report tokens for embeddings, so log the count of texts and characters
  and estimate.
- OpenRouter (Council): it already returns the real cost (`usage.cost`, stored on `council_turns`);
  log the same into `ai_usage`.

**Cost:** a price table in code (per model: input and output per million tokens, thinking billed as
output, plus a price per grounded search) turns tokens into dollars. Tokens are always stored, so the
cost can be recomputed if prices change. Prices must be copied from Google's pricing page when this
is built; nothing in the repo has them yet. This is an **estimate**: Google's billing is the real
number, so compare the two once a month and fix the table if they drift.

**Never breaks a call:** logging is best-effort. A failed insert is logged to the console and the AI
result is returned as normal.

**Where you see it:** an **AI usage** card in Settings:
- This month so far, and last month.
- By feature (bars), and the 5 most expensive saves.
- Average cost per save, and the average for what-ifs on their own.
- Optional: a monthly budget. A push at 80% and 100% (it's an alert only; nothing gets switched off).

**Data:** a new `ai_usage` table (additive), with `user_id` and the standard RLS
(`user_id = auth.uid() AND is_allowlisted()`), indexed on (`user_id`, time). Add its `Row` type to
`database.types.ts` by hand.

---

## Part B — What if…

### B1. Deciding the scenario

The classifier (Flash, one call already made for every save) gains one field: **`what_if`**, either a
one-line scenario question or null. Rules for the prompt:
- Null for recipes, how-tos, evergreen explainers, and anything with no sensible "at scale" future.
- Otherwise a specific question with a rough horizon, e.g. "What if solid-state batteries are in most
  new cars by 2030?", not "What if this becomes popular?".

No extra AI call. The scenario is stored with the what-if output.

### B2. Writing it (background, after the explainer)

A new best-effort step in `process-item`, after the explainer and before the push. It runs only when
`what_if` isn't null. It takes two calls because JSON mode can't be combined with Search (the same
pattern the digest's finds use):

1. **Facts:** a grounded Search call (fast tier) gathers where things stand today: who's doing it, how
   big it is now, the latest moves, with numbers. The sources are the pages Search actually read.
2. **The card:** the user's smart model writes the structured card from the save, the facts, and the
   sources, validated by a Zod schema.

If it fails, the save still finishes (the what-if is an extra, like the diagram), and the item page
offers "Try again".

### B3. The card's content

| Part | What | Rules |
|---|---|---|
| Scenario | The question | From B1 |
| Today | 2–3 facts, each with a source | Only from step 1; left out if Search found nothing. Never invented. |
| First effects | 2–3 lines | The first year or two |
| Knock-on effects | 2–3 lines | The second-order, less obvious effects |
| Winners / losers | 2–3 each | At least one loser. Name real kinds of players (companies, jobs, countries), not "society". |
| Timeline | Near / medium / long | Rough years |
| How likely | Low / medium / high + one line why | Honest, including "low" |
| Signals to watch | Exactly 3 | Concrete and checkable ("a major carmaker gives a price and date for a model"), never "more adoption" |
| Other scenarios | 2 short questions | e.g. "What if it flops?", "What if regulators step in?" Shown as buttons, written on tap. |

The prompt bans hype words and filler ("revolutionise", "game-changer", "in today's world"). The card is
always labelled **Speculation**. Source links come only from Search's grounding sources, like the
Council's `url_citations` rule.

### B4. On the item page

- The what-if card takes the big Play card's slot, right under the hero.
- Collapsed by default to the scenario, the likelihood and the three signals; tap to open the rest.
- Under it: the two **other scenarios** as buttons, **Your own what-if…** (a text box), **Debate it**
  (starts a Council session with the scenario), and **Ask about this** (puts the scenario into the
  item's chat).
- Other and custom scenarios run the same two calls on request and are stored as extra what-if
  outputs on the item. They're capped at, say, 5 per item, with each counted against the daily save cap.
- Uses the colour tokens and dark mode, and is checked at phone width.

### B5. Events

New `events` types: `whatif_open`, `whatif_scenario` (other or custom one asked for), and
`whatif_signal` (signal tapped). These feed the "how we'll know" numbers.

---

## Part C — Moving lessons out of the way

Nothing is deleted: existing lessons, scores and results stay.

- `process-item`: drop the `lesson` pre-write step. "Working on it…" loses "Making your 2-min lesson"
  and gains "Thinking through what if…" for eligible saves.
- Item page: remove the big Play card. "Play a 2-min lesson" becomes one of the Tools buttons, written
  when tapped (the lesson service already does that).
- Ready push: **Read / What if** buttons (What if deep-links to the card) instead of Read / Play. If a
  save has no what-if, show Read only.
- Feed card states: drop "lesson ready" and the score; a save is new, read, or reviewed. "Mastered"
  stays for saves that already have one.
- Up next: review due → an unread save with a what-if → the oldest unread.
- Reminders: the "lesson waiting" slot becomes "a what-if waiting". The Wednesday check-in stops
  counting lessons.
- Streak: a day counts with a save, an opened what-if, a lesson, or a review.
- Digest: the "suggested lesson" slot becomes "a what-if you haven't opened" until Part D replaces it
  with Signals spotted.
- Docs: SPEC.md (differences), RULES.md (paths table: `lib/whatif`, job steps), README if env changes.

---

## Part D — Signals (phase 2)

- Each signal is stored in its own row (new table: what-if, item, text, embedding, status
  `watching` / `spotted` / `happened` / `dismissed`, plus the spotting item or URL and when it was spotted). Standard RLS.
- **On save:** compare the new save's chunks with open signals. Above a threshold → "This looks like a
  sign for your what-if about X" on the item page and in the ready push. The threshold is **measured on
  real data first**, as with the 0.80 used for "Connects to".
- **Weekly:** the Sunday digest runs a grounded Search on open signals (the 10 most recent what-ifs;
  signals older than 6 months stop being checked) and adds a **Signals spotted** section with links.
- You can mark a signal **Happened** or **Dismiss** from the card or the digest. Over time this shows
  which what-ifs came true.

## Part E — later

A push when a signal is spotted, and what-if as the second half of the parked video idea.

---

## Database changes

All additive, but two widen existing `CHECK` constraints (dropping and recreating them with more
values). That changes an existing rule, so it **needs an explicit yes before it's applied**:

- `item_outputs.type`: add `whatif`.
- `events.type`: add `whatif_open`, `whatif_scenario`, `whatif_signal`.
- New tables: `ai_usage` (Part A), signals (Part D).

## Build order

1. **A** — usage tracking, and the Settings card. A few days of baseline.
2. **B + C together** — the what-if card in, lessons out of the way (shipping B without C leaves two
   competing cards).
3. Two weeks of use, then check the numbers above.
4. **D** — signals: on-save matching first, then the weekly digest check.
