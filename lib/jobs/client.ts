import { Inngest, eventType } from 'inngest';
import { z } from 'zod';

export const inngest = new Inngest({ id: 'heytoolie' });

/** A shared link needs fetching, classifying and handling. Also sent on Retry. */
export const itemQueued = eventType('item/queued', {
  schema: z.object({ itemId: z.uuid(), userId: z.uuid() }),
});
