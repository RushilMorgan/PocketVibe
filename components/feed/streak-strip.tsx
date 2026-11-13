import type { Streak, WeekProgress } from '@/components/types';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TARGET = { saveDays: 5, whatIfs: 1 };

const MILESTONE: Record<number, string> = {
  3: 'Three days running',
  7: 'A full week — the habit is forming',
  14: 'Two weeks strong',
  30: 'A month of learning',
  60: 'Two months. Seriously impressive',
  100: '100 days. Legend',
};

/** Streak (with its weekly freeze) and this week against the day-30 targets. */
export function StreakStrip({ streak, week, todayIndex }: { streak: Streak; week: WeekProgress; todayIndex: number }) {
  const { days, freezeLeft, activeToday, atRisk, milestone } = streak;
  const sub = atRisk
    ? `Save something or open a what-if tonight to keep your ${days}-day streak`
    : days === 0
      ? 'Save something or open a what-if today to start one'
      : activeToday
        ? milestone === days
          ? MILESTONE[days]
          : 'Done for today ✓'
        : 'Keep it going today';
  const onTrack = week.saveDays >= TARGET.saveDays && week.whatIfsOpened >= TARGET.whatIfs;
  const flameRing = days >= 30 ? 'bg-accent/20' : days >= 7 ? 'bg-warm/30' : days > 0 ? 'bg-warm/15' : 'bg-line';

  return (
    <section aria-label="Streak and this week" className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl ${flameRing} ${days ? '' : 'grayscale'}`}>
          🔥
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{days ? `${days}-day streak` : 'No streak yet'}</p>
          <p className={`mt-0.5 text-xs ${atRisk ? 'font-semibold text-warm' : 'text-muted'}`}>{sub}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${freezeLeft ? 'bg-accent/10 text-accent' : 'bg-line text-muted'}`}
          title="One missed day a week is covered automatically"
        >
          ❄️ {freezeLeft ? '1 freeze' : 'Freeze used'}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <ol className="flex gap-1.5" aria-label={`Saved on ${week.saveDays} of ${TARGET.saveDays} days this week`}>
          {DAYS.map((d, i) => (
            <li key={i} className="flex flex-col items-center gap-1">
              <span
                className={`h-5 w-5 rounded-full ${
                  week.savedOn[i] ? 'bg-warm' : i > todayIndex ? 'border border-dashed border-line' : 'bg-line'
                } ${i === todayIndex ? 'ring-2 ring-ink/70 ring-offset-1 ring-offset-surface' : ''}`}
              />
              <span className="text-[10px] text-muted">{d}</span>
            </li>
          ))}
        </ol>
        <div className="text-right text-xs">
          {onTrack ? (
            <p className="font-semibold text-success">On track this week ✓</p>
          ) : (
            <>
              <p>
                <span className="font-semibold">{week.saveDays}</span>
                <span className="text-muted">/{TARGET.saveDays} save days</span>
              </p>
              <p className={week.whatIfsOpened >= TARGET.whatIfs ? 'text-success' : ''}>
                <span className="font-semibold">🤔 {week.whatIfsOpened}</span>
                <span className="text-muted">/{TARGET.whatIfs} what-if</span>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
