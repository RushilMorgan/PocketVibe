# Recipes you come back to — spec and plan

Status (2026-11-14): **first set built** (migration `20261114202426_recipes_cooks`, applied). The second
set below is planned, not built.

## Why

On 2026-11-14 there were 8 recipes among 27 saves. All 8 had been opened, 7 more than once, but none
was opened again more than a day after it was saved: recipes were being looked at, not cooked from.
The recipe card itself was fine; finding a recipe later and following it at the stove were the gaps.

**How we'll know it worked** (the Stats page, `/stats`, checked after 4 weeks):
- At least 2 recipes cooked ("I cooked this").
- Recipes in the "came back" column of the By kind table, which was 0.

## First set (built)

| What | How |
|---|---|
| **Recipes page** `/recipes`, from the 🍳 Recipes chip on the feed | Every recipe save in a list. Search matches the title, tags, description and ingredient names (every word typed must match). Filters: Want to cook, 30 min or less, Not tried yet, Cooked, and any tag at least two recipes share. Search and filters run in the browser: it's one person's recipes. |
| **Want to cook** | A toggle on the Recipes page and the recipe card (`items.cook_list_at`). The list sorts first, latest added on top. Logging a cook takes the recipe off it. |
| **Cooking view** `/cook/[itemId]` (full screen, no tab bar) | Ingredients first, then one step per screen in large type. Under each step, the ingredients it uses: a guess from the words (`stepIngredients`), ignoring general words like "fresh" and "sauce". The screen stays on. |
| **Timers** | A step with a readable time ("5 min", "1 hr 15 min", "10-12 min" uses the lower bound) gets a Start button. Running timers show at the top of every screen; when one ends it buzzes, beeps three times and stays up until dismissed. Several can run at once. |
| **Progress that survives** | Ticks, the current screen and timer end times are kept in this browser (`localStorage`, key `cook:<itemId>`) for 12 hours. The recipe card and the cooking view share them. Nothing is stored on the server. |
| **I cooked this** | At the end of the cooking view, or from the recipe card: an optional 1–5 rating and a note for next time (table `cooks`). The card then shows how many times, when, and the last note. |

Limits:
- A timer only rings while the cooking view is open. If the phone is locked or the app is in the
  background, it shows "Time's up" when you return, with no sound in between. A real background
  alarm would need a push sent from the server.
- "For this step" can miss an ingredient the step doesn't name ("add the rest") or include one it
  mentions in passing.
- Progress is per device.

## Second set (planned)

- **Servings scaler** and **ingredient groups** ("for the sauce") with a copy-shopping-list button. Both
  need the recipe prompt to return quantities as numbers and a group per ingredient, and existing
  recipes re-extracted.
- **"What can I make?"**: type what you have; recipes ranked by how many ingredients match.
- **A weekend nudge**, "Cook one this week?", from the Want to cook list. Needs a new nudge kind (a
  widened CHECK on `nudges.kind`, which needs a yes).
- **Jump to the video moment** for a step. Depends on Gemini returning reliable timestamps; test first.
- Cooking counting towards the streak.
