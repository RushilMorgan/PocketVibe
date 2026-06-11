import type { GenerationStageEvent } from '../types';

export interface StageTimelineItem {
  key: string;
  label: string;
  done: boolean;
}

/**
 * Collapse raw pipeline stage events into a display timeline: a stage and its
 * `_done` twin share one line. Labels come from the caller's voice (Toolie's
 * generation narration, the cookbook's kitchen narration, …). Stages listed
 * in `adoptDoneLabels` upgrade their label once the `_done` event lands —
 * used for decision labels like "Got it — making you a budget calculator".
 */
export function buildStageTimeline(
  events: GenerationStageEvent[],
  labelFor: (ev: GenerationStageEvent) => string,
  adoptDoneLabels: readonly string[] = ['understand'],
): StageTimelineItem[] {
  const items: StageTimelineItem[] = [];
  for (const ev of events) {
    const base = ev.stage.replace(/_done$/, '');
    const isDone = ev.stage.endsWith('_done');
    const existing = items.find(i => i.key === base);
    if (existing) {
      if (isDone && adoptDoneLabels.includes(base)) existing.label = labelFor(ev);
      existing.done = existing.done || isDone;
    } else {
      items.push({ key: base, label: labelFor(ev), done: isDone });
    }
  }
  // Every stage before the latest one is finished by definition
  items.forEach((item, i) => {
    if (i < items.length - 1) item.done = true;
  });
  return items;
}
