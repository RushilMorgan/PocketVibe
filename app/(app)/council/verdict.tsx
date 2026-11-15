'use client';

import { createContext, useContext } from 'react';
import { verdictLabel, type Mode, type Verdict } from '@/lib/council/schemas';

const TONE: Record<Verdict, string> = {
  go: 'bg-success/15 text-success',
  refine: 'bg-accent/15 text-accent',
  park: 'bg-line text-muted',
  drop: 'bg-danger/15 text-danger',
};

/** The session's mode (decision / claim / question), so every verdict on the page is worded the same way. */
const ModeContext = createContext<Mode | null>(null);
export const VerdictMode = ModeContext.Provider;

/** "Go", "Holds up", "It depends"…: the verdict in the words for this session's mode. */
export function useVerdictLabel(): (verdict: Verdict) => string {
  const mode = useContext(ModeContext);
  return (verdict) => verdictLabel(verdict, mode);
}

export function VerdictBadge({ verdict, confidence, mode }: { verdict: Verdict; confidence?: number; mode?: Mode | null }) {
  const fromPage = useContext(ModeContext);
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-sm font-semibold ${TONE[verdict]}`}>
      {verdictLabel(verdict, mode ?? fromPage)}
      {confidence !== undefined && (
        <span aria-label={`confidence ${confidence} of 5`} className="tracking-[0.15em] font-normal opacity-80">
          {'●'.repeat(confidence)}
          {'○'.repeat(5 - confidence)}
        </span>
      )}
    </span>
  );
}
