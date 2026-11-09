import { councilFollowup } from './council-followup';
import { councilRun } from './council-run';
import { processItem } from './process-item';
import { weeklyDigest } from './weekly-digest';

/** Every Inngest function, served from /api/inngest. */
export const functions = [processItem, weeklyDigest, councilRun, councilFollowup];
