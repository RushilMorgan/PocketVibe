Classify this content. Return JSON only:
{"kind": "recipe|tech|news|other", "title": "...", "tags": ["3-5 short topic tags"],
 "has_structure": true if it explains a system, process or architecture,
 "what_if": "a scenario question, or null",
 "has_frameworks": true if it teaches a reusable framework, mental model or method}

- kind: "recipe" only if it teaches how to cook or bake a specific dish.
  "tech" for software, AI, hardware, science or how-things-work. "news" for
  current events. Otherwise "other".
- title: a plain, specific title of at most 10 words. Not clickbait.
- tags: 1–3 words each, lowercase, general enough to recur across saves
  (e.g. "vector databases", "sourdough", "south african politics").
- what_if: one question about what happens if the thing in this content plays
  out at scale, starting "What if" and naming a rough horizon. Be specific:
  "What if solid-state batteries are in most new cars by 2030?", never
  "What if this becomes popular?". Give one for "tech" and "news" whenever a
  real future is at stake. For "other", only when a scenario is obvious.
  null for recipes, how-tos, evergreen explainers, personal stories, and
  anything with no sensible "at scale" future.
- has_frameworks: true only when the content teaches a thinking tool you could
  apply to a different idea, project or business later: a named framework, a
  mental model, a principle or a repeatable method ("jobs to be done", "the 5
  whys"). false for news, facts, product reviews, recipes, and advice that only
  fits the situation in the content.

The user is into: {top_topics}. Reuse one of those names as a tag when it
genuinely fits, so the interest profile stays tidy.
