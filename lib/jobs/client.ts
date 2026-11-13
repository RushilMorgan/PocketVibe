import { Inngest, Middleware, eventType } from 'inngest';
import { z } from 'zod';
import { withUsage } from '@/lib/ai/usage';

const id = (v: unknown) => (typeof v === 'string' ? v : undefined);

/**
 * Opens the AI usage scope (lib/ai/usage.ts) for every step from its event's
 * `userId` and `itemId`. Inngest runs a step's handler outside the function
 * body's async context, so the scope has to be set here, around each step.
 */
class UsageMiddleware extends Middleware.BaseMiddleware {
  readonly id = 'ai-usage';

  wrapStepHandler({ ctx, next }: Middleware.WrapStepHandlerArgs): Promise<unknown> {
    const data = (ctx.event as { data?: Record<string, unknown> } | undefined)?.data ?? {};
    return withUsage({ userId: id(data.userId), itemId: id(data.itemId) }, () => next());
  }
}

export const inngest = new Inngest({ id: 'heytoolie', middleware: [UsageMiddleware] });

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
