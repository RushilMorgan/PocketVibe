/**
 * Guess the user's intent from how they wrote their idea, so the intent step
 * arrives pre-selected ("✨ Suggested") instead of as five cold options.
 * Heuristic and cheap by design — the user can always change it.
 */
export function suggestIntent(idea: string): string {
  const t = idea.toLowerCase();
  // A personal fork in the road ("should I…", "X or Y?") → decision framing
  if (/\bshould (i|we)\b|can'?t decide|torn between|choose between|\bor keep\b|\bor stay\b|worth (it|doing|pursuing)/.test(t)) {
    return 'decide';
  }
  // Two named things side by side → comparison framing
  if (/\bvs\.?\b|\bversus\b|difference[s]? between|compared? (to|with)|which (one|is better)/.test(t)) {
    return 'compare';
  }
  // A question about how the world works → learning framing
  if (/^(what|how|why)\b|\bunderstand(ing)?\b|\blearn(ing)? about\b|\bexplain\b|curious about/.test(t)) {
    return 'learn';
  }
  if (/brainstorm|ideas? for|ways to|come up with/.test(t)) {
    return 'brainstorm';
  }
  return 'validate';
}
