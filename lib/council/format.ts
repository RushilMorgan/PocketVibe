import type { Citation } from '@/lib/ai/openrouter';
import { LETTER, type MemberSeat } from './roster';
import type { Draft, Frame, MemberVote, Rebuttal, Source, Take } from './schemas';

/**
 * Pure helpers that turn one stage's output into the next stage's prompt
 * text, plus the vote logic. Kept free of I/O so they're unit-tested.
 */

export function frameText(frame: Frame): string {
  return [
    `Idea (${frame.kind}): ${frame.restated}`,
    `Assumptions it rests on:\n${frame.assumptions.map((a) => `- ${a}`).join('\n')}`,
    `Sections to judge it on:\n${frame.sections.map((s) => `- ${s.key}: ${s.heading} — ${s.focus}`).join('\n')}`,
  ].join('\n\n');
}

/** Splits the research questions between researchers, round-robin. */
export function splitQuestions(questions: string[], researchers: number): string[][] {
  const out: string[][] = Array.from({ length: researchers }, () => []);
  questions.forEach((q, i) => out[i % researchers].push(q));
  return out.filter((q) => q.length);
}

/** One numbered source list across all briefs, first appearance wins. */
export function numberSources(lists: Citation[][]): Source[] {
  const seen = new Map<string, Source>();
  for (const c of lists.flat()) {
    if (!seen.has(c.url)) seen.set(c.url, { n: seen.size + 1, url: c.url, title: c.title || new URL(c.url).hostname });
  }
  return [...seen.values()];
}

/** The research as members read it: briefs, then sources they may cite as [S1]. */
export function researchText(briefs: string[], sources: Source[]): string {
  if (!briefs.length) return '(No web research was available — say where evidence is missing.)';
  const list = sources.map((s) => `[S${s.n}] ${s.title} — ${s.url}`).join('\n');
  return `${briefs.map((b, i) => `Brief ${i + 1}:\n${b}`).join('\n\n')}\n\nSources:\n${list || '(none)'}`;
}

export function takeText(take: Take): string {
  return [
    `Stance: ${take.stance} (confidence ${take.confidence}/5)`,
    take.summary,
    ...take.sections.map((s) => `${s.key}:\n${s.points.map((p) => `- ${p}`).join('\n')}`),
    take.strengths.length ? `Strengths:\n${take.strengths.map((s) => `- ${s}`).join('\n')}` : '',
    take.risks.length
      ? `Risks:\n${take.risks.map((r) => `- [${r.severity}] ${r.risk} (test: ${r.test})`).join('\n')}`
      : '',
    take.next_steps.length ? `Next steps:\n${take.next_steps.map((s) => `- ${s}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Everyone else's view, by letter only. */
export function othersText(takes: Partial<Record<MemberSeat, Take>>, self: MemberSeat): string {
  return (Object.entries(takes) as [MemberSeat, Take][])
    .filter(([seat]) => seat !== self)
    .map(([seat, take]) => `Member ${LETTER[seat]}:\n${takeText(take)}`)
    .join('\n\n');
}

export function rebuttalText(r: Rebuttal): string {
  return [
    `Final stance: ${r.stance} (confidence ${r.confidence}/5)`,
    r.changed_mind ? `Changed mind: ${r.changed_mind}` : '',
    r.challenges.length ? `Challenges:\n${r.challenges.map((c) => `- to ${c.member}: ${c.point} — ${c.why}`).join('\n')}` : '',
    r.concessions.length ? `Concedes:\n${r.concessions.map((c) => `- ${c}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The full debate for the chair: each member's take and rebuttal, by letter. */
export function debateText(takes: Partial<Record<MemberSeat, Take>>, rebuttals: Partial<Record<MemberSeat, Rebuttal>>): string {
  return (Object.keys(takes) as MemberSeat[])
    .map((seat) => {
      const r = rebuttals[seat];
      return `Member ${LETTER[seat]}\n${takeText(takes[seat]!)}${r ? `\n\nAfter debate:\n${rebuttalText(r)}` : ''}`;
    })
    .join('\n\n---\n\n');
}

export function draftText(d: Draft): string {
  return [
    `Verdict: ${d.verdict} (confidence ${d.confidence}/5)`,
    `Headline: ${d.headline}`,
    d.summary,
    ...d.sections.map((s) => `${s.heading}:\n${s.points.map((p) => `- ${p}`).join('\n')}`),
    d.disagreements.length ? `Disagreements:\n${d.disagreements.map((x) => `- ${x.topic}: ${x.sides}`).join('\n')}` : '',
    `Next steps:\n${d.next_steps
      .map((s, i) => `${i + 1}. ${s.step} (${s.effort}) — why: ${s.why}; stop if: ${s.kill_signal}`)
      .join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** The draft goes back for a rewrite when any member wants changes or dissents. */
export function needsRevision(votes: MemberVote[]): boolean {
  return votes.some((v) => v.vote !== 'agree');
}

export function votesText(votes: MemberVote[]): string {
  return votes
    .map((v) => `${v.member}: ${v.vote}${v.notes ? ` — ${v.notes}` : ''}${v.changes.map((c) => `\n  - ${c}`).join('')}`)
    .join('\n');
}

export interface Tally {
  agree: number;
  agree_with_changes: number;
  dissent: number;
}

export function tally(votes: MemberVote[]): Tally {
  const t: Tally = { agree: 0, agree_with_changes: 0, dissent: 0 };
  for (const v of votes) t[v.vote]++;
  return t;
}
