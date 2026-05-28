/**
 * remixContent — strips private/personal data from a shared creation's content
 * so the remixed copy starts clean and belongs to the new owner.
 *
 * Public structural data (teams, participants, rules, theme) is kept.
 * Private data (activity logs, change requests, draw lock) is cleared.
 */
import type { CreationContent } from '../types';

export function remixContent(content: CreationContent, creationType: string): CreationContent {
  const base = { ...content } as Record<string, unknown>;

  // Always strip pending change requests — those belong to the original pool
  if ('changeRequests' in base) base.changeRequests = [];

  if (creationType === 'workout_tracker') {
    // Activity logs are personal data — strip them so the remixer starts fresh
    base.logs = [];
  }

  if (creationType === 'tournament_pool_tracker') {
    // New owner runs their own draw; reset the lock so they can redo it
    base.drawLocked = false;
  }

  return base as unknown as CreationContent;
}
