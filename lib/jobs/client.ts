import { Inngest, eventType } from 'inngest';
import { z } from 'zod';

export const inngest = new Inngest({ id: 'heytoolie' });

/** A shared link needs fetching, classifying and handling. Also sent on Retry. */
export const itemQueued = eventType('item/queued', {
  schema: z.object({ itemId: z.uuid(), userId: z.uuid() }),
});

/** A new idea for the Council (also sent on Retry). */
export const councilQueued = eventType('council/session.queued', {
  schema: z.object({ sessionId: z.uuid(), userId: z.uuid() }),
});

/** A follow-up question on a finished Council report; `round` ≥ 1. */
export const councilFollowupQueued = eventType('council/followup.queued', {
  schema: z.object({ sessionId: z.uuid(), userId: z.uuid(), round: z.number().int().min(1), question: z.string() }),
});
