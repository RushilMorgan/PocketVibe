Classify this content. Return JSON only:
{"kind": "recipe|tech|news|other", "title": "...", "tags": ["3-5 short topic tags"],
 "has_structure": true if it explains a system, process or architecture,
 "what_if": "What if …?" or null}

- kind: "recipe" only if it teaches how to cook or bake a specific dish.
  "tech" for software, AI, hardware, science or how-things-work. "news" for
  current events. Otherwise "other".
- title: a plain, specific title of at most 10 words. Not clickbait.
- tags: 1–3 words each, lowercase, general enough to recur across saves
  (e.g. "vector databases", "sourdough", "south african politics").

- what_if: one specific question about what happens if the thing in this
  content plays out at scale, with a rough horizon — e.g. "What if
  solid-state batteries are in most new cars by 2030?", never "What if this
  becomes popular?". Global, not one country. Null for recipes, how-tos,
  evergreen explainers and anything with no sensible "at scale" future.

The user is into: {top_topics}. Reuse one of those names as a tag when it
genuinely fits, so the interest profile stays tidy.
