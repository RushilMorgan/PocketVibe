# HeyToolie reboot — SPEC

## Overview

A personal web app on heytoolie.com. You share any news article, YouTube Short or recipe link to it from the Android share sheet, and it gives back the useful version: a clean recipe, a simple explanation, a diagram or a 2-minute playable lesson. It also learns what you care about and finds more of it.

It's built for one user first, so opening it to strangers later means flipping a switch, not rebuilding. (An earlier Telegram plan was dropped: Telegram now charges some South African sign-ups, which would block strangers.)

### What it does

- **Save** — share any link from any Android app straight to HeyToolie.
- **Understand** — works out what the link is and runs the right handler (recipe, article, video).
- **Explain** — plain-language summaries at your level, with diagrams for tech topics.
- **Play** — a tap-to-open mini-game that teaches the concept (quiz, simulator, ordering, spot-the-bug).
- **Chat** — ask questions about anything you've saved.
- **Discover** — a weekly digest of your themes plus new finds on them.

### Success test (decide on day 30)

- [ ] Saved something on at least 4–5 days a week for 4 weeks
- [ ] Played at least 1 lesson a week
- [ ] Opened at least 3 of the 4 weekly digests

All three ticked → open it to strangers. Fewer → it stays a personal tool.

## Architecture and stack

heytoolie.com is an installable PWA. On Android it registers as a share target, so it appears in the share sheet next to WhatsApp. All logic lives in one backend API, so a native app or a WhatsApp front door could plug into the same backend later.

| Layer | Choice | Why |
|---|---|---|
| Front end | Next.js PWA on heytoolie.com (manifest.json + service worker) | Installs to the home screen; no app store |
| Sharing | Web Share Target API (`share_target`, POST to `/share`) | HeyToolie in the Android share sheet |
| Login | Supabase Auth magic link (email only) | No passwords, no phone number |
| Backend | Next.js API routes on Vercel (`/api/items`, `/api/chat`, `/api/lessons`) | One codebase for site and API |
| Background jobs | Inngest (or Vercel Cron + a jobs table) | Video processing outlasts a normal request |
| Notifications | Web Push (VAPID, `web-push`) + email fallback (Resend) | "Your explainer is ready" and the weekly digest |
| AI | Gemini API (2.5 Flash default, Pro for lessons) | Takes YouTube URLs directly |
| Embeddings | Gemini embeddings into pgvector | "Similar", chat retrieval, interest profile |
| Database | Supabase Postgres + pgvector + Storage (diagram PNGs) | Data, vectors and files in one place |
| Diagrams | Mermaid → PNG (mermaid-cli or Kroki), or live in the browser | Accurate and cheap |
| Lessons | Pages at `/play/[lessonId]` | Full-screen games, same site |
| Discovery | Gemini with Google Search grounding | No extra vendor |

### Rules for Claude Code

(The full, current working rules live in [RULES.md](RULES.md); these are the originals.)

- Keep all business logic in `/lib` and the API routes. Pages only call the API.
- Every table has a `user_id` from day one.
- Reuse the existing HeyToolie recipe extractor as the recipe handler.
- Lock sign-up to an email allowlist until the strangers test.
- Keep the current recipe-extractor page live at `/tools/recipe-extractor` so existing ad links don't break.

## Data model

Six tables. The profile is built from what you save and how you react, not filled in by hand.

| Table | Key fields | Notes |
|---|---|---|
| users | id, email, push_subscription, display_name, level (beginner/some-code/dev), tone, created_at | One row for now |
| items | id, user_id, url, source (youtube/article/tiktok/other), kind (recipe/tech/news/other), title, status (queued/done/failed), raw_text, summary, created_at | One row per shared link |
| item_outputs | id, item_id, type (recipe/explainer/diagram/lesson), content jsonb, file_url | Everything generated for an item |
| chunks | id, item_id, text, embedding vector(768) | Chat retrieval and "similar" |
| topics | id, user_id, name, embedding, weight, last_seen_at | Interest profile; weight rises with saves, thumbs-up, plays |
| events | id, user_id, item_id, type (saved/opened/played/score/thumbs/digest_open), value, created_at | Powers the day-30 test |

Lesson content shape (`item_outputs.content`, type `lesson`):

```json
{ "template": "quiz | simulator | order | spot_bug",
  "concept": "What a vector database is",
  "steps": [ "...template-specific..." ],
  "takeaway": "One sentence to remember" }
```

## Phase 1 — Share, explanations, chat (weekends 1–2)

Goal: share a Short from the YouTube app and get a simple explanation back in under a minute. Weekend 1 = backend and handlers; weekend 2 = PWA shell, share target, login, chat page.

### Flow

1. Share → HeyToolie. The share target POSTs the URL to `/share`, which shows "Got it, working on it…" at once.
2. The API creates an `items` row and queues a job.
3. **Fetch** — YouTube/Shorts URLs go straight to Gemini as video input. Articles go through a readability extractor (Mozilla Readability or Jina Reader). TikTok/Instagram start with caption and page text only.
4. **Classify** — one cheap Gemini call returns kind, title and 3–5 topic tags as JSON.
5. **Handle**
   - recipe → existing recipe extractor → recipe card (ingredients + steps)
   - tech / news / other → explainer prompt → 5-line summary, "why it matters", 3 things to explore next
6. **Index** — chunk the text, embed it, update topic weights.
7. **Notify** — web push ("Your explainer is ready") opening the item page, with Explain simpler · Go deeper · Similar · 👍 / 👎. (Phase 2 adds Diagram, Phase 3 adds Play.)

### Screens

- **Home** — feed of saved items, newest first, filter by topic. Paste box as a fallback when an app has no share button.
- **Item page** — the output plus a chat box about that item.
- **Ask** — "ask my library": top 8 chunks by vector search, answer with links to source items. Streamed.
- **Settings** — your topics (editable), explanation level, forget a topic.

### Profile

- Each save adds +1 to matching topics (cosine > 0.8) or creates a new topic.
- 👍 +2, 👎 −2. Weights decay 10% a week.
- Top 5 topics are injected into every prompt as "what this user is into".

### Done when

- [ ] Shorts, articles and recipes all return a useful reply in under 60 s
- [ ] Chat answers questions about saved items and cites them
- [ ] `/topics` shows a sensible profile after 20 saves

## Phase 2 — Diagrams (week 2)

Mermaid code rendered to PNG. No image-generation models (they garble labels).

1. Diagram button, or automatic when the item is tech and the classifier flags `has_structure: true`.
2. Gemini returns Mermaid (flowchart, sequence or mindmap), ≤ 8 nodes, labels ≤ 4 words.
3. Validate with `mermaid.parse()`. On failure retry once with the error attached, then fall back to text only.
4. Render to PNG at 1080 px wide, store in Supabase Storage. Show on the item page with a one-line caption and tap-to-zoom.

Done when:
- [ ] 9 of 10 tech items produce a diagram that renders and makes sense
- [ ] Diagrams are readable on a phone without zooming

## Phase 3 — Quiz lessons (week 3)

Play opens a 2-minute full-screen quiz. The AI writes only JSON; one fixed React template renders it.

```json
{ "template": "quiz", "concept": "...",
  "intro": "2-sentence hook in plain words",
  "questions": [ { "q": "...", "options": ["a","b","c"], "answer": 1,
                   "why": "1-2 sentence explanation" } ],
  "takeaway": "..." }
```
(exactly 5 questions)

- `/play/[lessonId]`, behind login, works offline once loaded (SW cache).
- One question per screen, big tap targets, instant right/wrong with the why.
- `navigator.vibrate(20)` on each answer. Follows system light/dark.
- End screen: score, takeaway, Another on this topic, Back to item.
- Log `played` and `score` events.
- Validate with Zod before saving; regenerate once if invalid.

Done when:
- [ ] A quiz opens in under 2 s on the phone
- [ ] Questions test understanding, not trivia from the video

## Phase 4 — More games and discovery (week 4)

The AI picks the template; you can override.

| Template | Best for | AI fills in | Player does |
|---|---|---|---|
| Simulator | How a system works | 4–6 states: label, what's happening, node to highlight | Taps Next, watches the highlight move |
| Order | Processes, pipelines | 5–7 steps in correct order | Drags into order, sees the explanation |
| Spot the bug | Code concepts | 6–12 lines, bug line, why, fix | Taps the broken line |

**Weekly digest** (Sunday 18:00 SAST, Vercel Cron, web push + email)
- "Your week": saves grouped by topic, one line each.
- "New for you": 3 finds per top-3 topic via Gemini + Search grounding, excluding anything saved.
- One suggested lesson from something saved but never opened.
- Log `digest_open` when any button is tapped.

Done when:
- [ ] All four templates render from AI content without manual fixes
- [ ] The digest has at least 1 find per week you actually open

## Prompts

Kept in `/prompts/*.md` so they can be tuned without code changes. Every prompt gets `{level}`, `{tone}` and `{top_topics}`.

**Classifier** (Flash, JSON mode)
```
Classify this content. Return JSON only:
{"kind": "recipe|tech|news|other", "title": "...", "tags": ["3-5 short topic tags"],
 "has_structure": true if it explains a system, process or architecture}
```

**Explainer**
```
You explain things to a smart person who is not an expert. Level: {level}.
They are into: {top_topics}.
Rules: no jargon without a 5-word definition; one everyday analogy;
max 5 short lines. Then "Why it matters:" in 1 line.
Then "Explore next:" with 3 specific things to look up.
If the content makes claims, say plainly which are hype vs established.
```

**Diagram**
```
Draw the core idea as Mermaid (flowchart LR, sequenceDiagram or mindmap).
Max 8 nodes, labels max 4 words, no styling. Return only the Mermaid code.
```

**Lesson**
```
Create a 2-minute lesson on the ONE core concept in this content.
Pick the template that fits best: quiz | simulator | order | spot_bug
(spot_bug only if the concept is code). Return JSON matching the schema.
Test understanding, not recall of the video. Plain words, level {level}.
```

## Guardrails

- Email allowlist on sign-up; RLS on every table (`user_id = auth.uid()`).
- `/share` requires a session; if missing, save the URL locally and ask to log in.
- Hard Gemini spend cap in Google Cloud billing; soft cap of 50 items/day in code.
- Videos over 20 minutes: skip or summarise captions only.
- Failed jobs show "Couldn't read that one" with Retry. Nothing fails silently.

**Costs:** a few dollars a month in Gemini for one user; Supabase, Vercel, Resend on free tiers. Check real spend in week 1.

## Out of scope until the day-30 test passes

- Other users, onboarding, payments
- iPhone sharing (an iOS Shortcut can cover it later)
- Running real code in a sandbox
- A native app (a TWA can put the PWA in the Play Store later)
- TikTok/Instagram video understanding beyond the caption

## Build status

All four phases are built and live on heytoolie.com (November 2026). The day-30 test runs from the
first real use. Email for the weekly digest is wired up but waits on a Resend key; until then the
digest is delivered by push.

## Implementation notes — where the build differs from this spec

Deliberate changes, each made for a measured or practical reason. How the code works day to day is in
[RULES.md](RULES.md).

**Data model**
- Extra tables: `item_topics` (filter the feed by topic), `push_devices` (one row per device instead
  of `users.push_subscription`), `allowed_emails` (the sign-up allowlist, enforced by an auth hook),
  `digests` (the weekly digest and when it was first opened — the day-30 test counts digests, not
  taps), `public_tool_usage` (daily limit for the recipe tool while it was public; now unused), `chat_messages` (chat
  history, so answers survive leaving the page).
- `items.status` also has `processing`, and items have an `error` for the "Couldn't read that one"
  card. The `score` event stores the fraction right, so all lesson templates compare.

**Profile**
- A tag joins an existing topic at cosine **≥ 0.9**, not 0.8. With `gemini-embedding-001` unrelated
  tags already score 0.75–0.82 ("javascript" vs "sourdough" = 0.816), so 0.8 merged everything.
- Plays add +1 to the item's topics (the spec mentions plays raising weight without a number).

**Fetching and handlers**
- Videos over 20 minutes are skipped with a clear message rather than summarised from captions.
- A recipe is indexed from its extracted card, not the raw page (cleaner chat answers).
- The explainer keeps the 5-line summary but adds a full `list` whenever the content is a list,
  ranking, top-N, comparison or set of steps — every entry with its score and reason. Five lines
  can't hold a "top 9" video.
- "Ask" searches each clause of a compound question separately and takes at most 3 of the top 8
  chunks from any one save, so one long article can't crowd out the rest.

**Diagrams**
- `mermaid.parse()` runs on the server under jsdom. Rendering goes through Kroki at a large font and
  is only scaled down/padded to 1080 px with sharp — Vercel's functions have almost no fonts.
- Long chains are drawn top-down rather than left-to-right so they stay readable on a phone.

**Lessons**
- A cheap Flash call picks the template, then Gemini Pro writes JSON for that one template's schema
  (simpler and more reliable than one union schema). Quiz answers are shuffled server-side.
- A lesson is pre-written in the background after each non-recipe save so Play opens instantly.

**Digest**
- Vercel Cron triggers it, but the work runs as an Inngest job with one step per topic (each topic's
  search takes 30–70 s).
- "New for you" only uses pages Google Search actually read (grounding sources), each fetched to
  confirm it's live and a real article/video, then Flash picks up to 3 per topic, varied across topics.
- Every digest link goes through a signed tracker (`/d/…`), so taps from email count without a login.

**Models and access**
- Instead of 2.5 Flash/Pro: Gemini 3.8 Flash for videos, recipes and plumbing; Gemini 4 Argon for
  explainers, lessons, diagrams and chat (benchmarked on real saves — Argon's explainers and quizzes
  were clearly sharper and more personal; on big inputs Flash matched it at a third of the cost).
- Settings has a model picker for those jobs (Argon / 3.1 Pro / 3.8 Flash) with rough cost per
  save; video and recipe reading always use 3.8 Flash.
- Chat answers from the saves first (cited), then adds the model's own knowledge under
  "Beyond your saves:" instead of refusing.
- Single-user lockdown: RLS also requires an allowlisted email, the old site's tables, functions and
  edge functions are closed or deleted, and `/tools/recipe-extractor` (kept at its old URL) now
  requires sign-in.

**Council (not in the spec)**
- A fifth tab, `/council`: put an idea to five models from different labs (via OpenRouter) that
  frame it, research it on the web, take independent views, cross-examine each other (anonymised),
  and vote on the chair's report — one revision if anyone objects, dissent kept verbatim. Then
  follow-up questions, each answered by every member and ratified. Web research only; it doesn't
  read your saves. Tables `council_sessions` and `council_turns`.
