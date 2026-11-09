import { VERDICT_LABEL, type Verdict } from '@/lib/council/schemas';

const TONE: Record<Verdict, string> = {
  go: 'bg-success/15 text-success',
  refine: 'bg-accent/15 text-accent',
  park: 'bg-line text-muted',
  drop: 'bg-danger/15 text-danger',
};

export function VerdictBadge({ verdict, confidence }: { verdict: Verdict; confidence?: number }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-sm font-semibold ${TONE[verdict]}`}>
      {VERDICT_LABEL[verdict]}
      {confidence !== undefined && (
        <span aria-label={`confidence ${confidence} of 5`} className="tracking-[0.15em] font-normal opacity-80">
          {'●'.repeat(confidence)}
          {'○'.repeat(5 - confidence)}
        </span>
      )}
    </span>
  );
}
