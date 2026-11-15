# Recipes you come back to — spec and plan

Status (2026-11-15): **first set live** (migration `20261114202426_recipes_cooks`). **Second set built on a
branch, not live**: its one migration, `20261115090000_cook_nudge`, widens a CHECK on `nudges.kind`
and is written but not applied (it needs a yes).

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

## Second set (built, not live)

| What | How |
|---|---|
| **Servings stepper** on the recipe | − / + on the Serves tile rescales every amount (`scaleQuantity`). Quantities are the text the prompt writes: "1/2", "1 1/2", "2-3" and "½" scale; "a pinch" is left as written. Results are rounded the way a cook would say them (3/4, 1 1/2), not exactly. The choice carries into the cooking view and lasts as long as cooking progress does (12 hours, this device). Works on recipes saved before this. |
| **Ingredient groups** | The recipe prompt now gives each ingredient its part ("Marinade", "Sauce", "To serve"). Shown as headings when a recipe names at least two parts. **Only recipes saved from now on have them**; older ones stay one list. |
| **Copy shopping list** | Copies what isn't ticked yet, at the chosen servings, under the group headings, as plain text. |
| **What can I make?** on the Recipes page | Type what you have ("chicken, rice and garlic"). Recipes are ranked by how many of those they use, then by how few other ingredients they need. Whole words, singular or plural. It does not know about staples: salt and oil count as "more to get" unless typed. |
| **Weekend cook nudge** | Saturdays, in your reminder slot: the recipe that has waited longest on the Want to cook list, at most once every 6 days, preferring ones not nudged about before. It comes after a streak about to break and before a what-if. New nudge kind `cook`. |
| **Watch this step** in the cooking view | For YouTube recipes, the prompt now asks for the second each step starts at, and the step links to the video at that moment. **Only recipes saved from now on**, and only steps Gemini could place. |
| **Cooking counts for the streak** | A day with an "I cooked this" is an active day. |

Not verified against real Gemini (this was built without access to it): whether the model fills in
groups sensibly, and how accurate the step times in a video are. Check both on the first few new
recipes; if the times are off, remove `at` from the prompt and the links disappear.

Still open: re-reading older recipes so they get groups and video moments (re-saving one does it today),
and a true background timer alarm.
