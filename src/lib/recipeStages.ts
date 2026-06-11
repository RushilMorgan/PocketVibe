import type { GenerationStageEvent } from '../types';

/**
 * Kitchen-voiced labels for the real extraction pipeline stages — the same
 * stage events the generation theater narrates, retold as Toolie cooking up
 * a recipe card from the user's video link (or pasted text).
 */
export function recipeStageLabel(ev: GenerationStageEvent, hasVideo: boolean): string {
  switch (ev.stage) {
    case 'understand':
      return hasVideo ? 'Opening your video…' : 'Reading your recipe…';
    case 'understand_done':
      return 'Found the dish';
    case 'design':
      return 'Laying out the recipe card…';
    case 'design_done':
      return 'Recipe card ready';
    case 'build':
      return hasVideo
        ? 'Watching the video and writing it all down…'
        : 'Writing down the ingredients and steps…';
    case 'check':
      return 'Double-checking quantities and steps…';
    case 'repair':
      return 'Fixing a smudge on the card…';
    default:
      return 'Cooking…';
  }
}
