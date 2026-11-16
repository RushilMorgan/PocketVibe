# Playbook: frameworks you keep and use

Status (2026-11-16): **built on a branch, not live.** Migration `20261116071429_playbook` (three new
tables) is applied. Not yet run against the real models; see "Not verified".

## Why

Some saves teach a way of thinking that outlasts the article: a framework, a mental model, a method.
The explainer summarises the save, but the framework ends up buried in one save's page, and there was
nowhere to go when starting on an idea and wanting to use what had been learned.

## What it does

**Pull out.** The classifier now also answers `has_frameworks`. When it's true (never for recipes),
the job runs one more step after indexing: the smart model reads the save and returns up to 4
frameworks, or none. The prompt is strict on purpose: no facts, opinions, one-off tips or vague
advice. Each framework has:

| Field | What |
|---|---|
| name, kind, from | Its real name; framework / mental model / principle / process / rule of thumb; who the content credits |
| gist | One plain sentence |
| parts | Its steps or components, in order (empty for a single principle) |
| use_when, watch_out | The situation it helps with; where it misleads (null rather than invented) |
| example | The content's own example |
| questions | 2–4 questions it makes you ask of your own idea |
| areas | 1–3 short areas ("pricing", "strategy"), for the filter chips |

- Any other finished save has a **Pull out frameworks** button on its page (older saves, or ones the
  classifier didn't flag). If there's nothing reusable it says so.
- The step is best-effort: if it fails the save still finishes, and the button is there.

**Keep.** Everything pulled out goes straight into the Playbook tab; there is no "keep" tap. (Lessons
taught us that an extra tap doesn't happen.) Remove takes one out.

- A framework is in the playbook once. Names are reduced to a key (`nameKey`: lowercase, no brackets,
  no leading "the", no trailing "framework"), and the extractor is shown the names already kept and
  told to reuse them. Meeting "Jobs to be done" in a second save links that save to the existing
  entry; the first wording stays.
- Deleting a save keeps its frameworks.
- The tab has a search box and area chips once there are 6 or more.

**Use.** At the top of the tab: "What are you working on?"

1. The fast model sees the idea and a numbered list of your frameworks (newest 80) and picks up to 3
   that would each show something specific. It may pick none, and then the run is refused with a
   message rather than forced. **Apply to an idea** on a framework skips the pick and uses that one
   (up to 3 can be chosen).
2. The smart model works the idea through each: one point per part, the main insight, and what you'd
   need to find out. Then a bottom line and 2–4 next steps for this week.
3. The run is saved (`playbook_runs`) and listed under "Worked through". Each lens stores the
   framework's name, so it still reads if the framework is later removed.

A run uses only your words and the frameworks: it does no web research, the prompt forbids made-up
numbers and markets, and the page says so. For research, **Stress-test it with the Council** sends
the idea, each framework's insight and the bottom line to a Council session (its own cap and cost).

## Limits and cost

- 20 runs per 24 hours. Extraction runs once per flagged save; the button once per save.
- Extraction is one smart-model call over up to 30,000 characters of the save. A run is one fast
  call and one smart call. Both are logged to `ai_usage` as `frameworks` and `playbook`, so the
  Settings usage card shows what they really cost.

## Where it lives

- `lib/playbook`: `schema.ts` (Zod shapes, client-safe), `shape.ts` (pure, tested), `generate.ts`
  (the three AI calls), `service.ts`.
- Prompts: `frameworks.md`, `playbook-pick.md`, `playbook-apply.md`; one new field in `classifier.md`.
- API: `GET /api/playbook`, `POST /api/playbook/runs`, `GET/DELETE /api/playbook/runs/[id]`,
  `POST /api/playbook/runs/[id]/council`, `DELETE /api/playbook/frameworks/[id]`,
  `GET/POST /api/items/[id]/frameworks`.
- Pages: `/playbook`, `/playbook/runs/[id]`; a "For your playbook" section on the item page.

## Not verified

Built without Gemini or Supabase keys. The screens were checked at phone width, light and dark, with
made-up data; no real save has been through it. To check on the first few real saves:

- that `has_frameworks` isn't too eager (news flagged) or too shy (a clear how-to-think video missed);
- that extracted frameworks are real and reusable, and stay within the schema's length limits (a
  too-long field fails the whole extraction);
- that the picker's choices make sense, and that a run's findings are about the idea rather than a
  restatement of the framework;
- that a run finishes inside the route's 120 seconds.

## Not built

- Writing in a framework by hand, or editing one.
- Frameworks in review cards, the digest, the feed cards or the ready push.
- Ask already answers from the saves the frameworks came from, so it wasn't changed.
