/**
 * Builds the generation prompt for the Recipe tool from the intake inputs.
 * The prompt degrades gracefully: with a URL only (and no video ingestion yet)
 * the model produces a best-effort recipe for the named dish; with pasted text
 * it structures that text reliably.
 */
export interface RecipeIntakeInput {
  youtubeUrl: string;
  manualText: string;
  servings?: number;
  dietary?: string;
}

export function buildRecipePrompt(input: RecipeIntakeInput): string {
  const lines: string[] = [];

  if (input.youtubeUrl.trim()) {
    lines.push(`Extract a clear, structured recipe from this cooking video: ${input.youtubeUrl.trim()}.`);
    lines.push(`Use the video to identify the dish, its ingredients and the method.`);
  }
  if (input.manualText.trim()) {
    lines.push(`Here is the recipe to structure:\n"""\n${input.manualText.trim()}\n"""`);
  }
  if (input.servings) lines.push(`Scale it for ${input.servings} servings.`);
  if (input.dietary && input.dietary !== 'none') {
    lines.push(`Adapt it to be ${input.dietary} where reasonable, and note any swaps in the steps.`);
  }

  lines.push(
    'Produce a beginner-friendly recipe: a short title, servings, prep time and cook time, ' +
    'a complete ingredient list (each with a name, and a quantity/unit where known), and clear ' +
    'numbered steps written so a first-time cook can follow them (no assumed knowledge). ' +
    'Keep ingredient quantities as plain text (e.g. "1/2 cup", "a pinch"). ' +
    'Set every ingredient\'s "have" to false, leave "extraShoppingItems" empty, leave "notes" empty, ' +
    'and set "layoutMode" to "card". Put the source video URL in "sourceUrl" if one was provided.',
  );

  return lines.join(' ');
}
