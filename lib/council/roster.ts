import { z } from 'zod';

/**
 * Who sits on the Council: a chair who frames and writes up, and four members
 * from different vendors, each with a lens so they don't all say the same
 * thing. Ids are OpenRouter's (checked against /api/v1/models, Nov 2026).
 * COUNCIL_MODELS swaps a seat's model without a code change.
 */

export const SEATS = ['chair', 'skeptic', 'builder', 'market', 'wildcard'] as const;
export type Seat = (typeof SEATS)[number];
export type MemberSeat = Exclude<Seat, 'chair'>;
export const MEMBER_SEATS: MemberSeat[] = ['skeptic', 'builder', 'market', 'wildcard'];

export interface SeatInfo {
  label: string;
  /** Read by the model: how this seat should look at the idea. */
  lens: string;
  model: string;
}

export const DEFAULT_ROSTER: Record<Seat, SeatInfo> = {
  chair: {
    label: 'Chair',
    lens: 'Fair, rigorous synthesiser. Weighs evidence over eloquence and keeps real disagreement visible.',
    model: 'anthropic/claude-opus-5.5',
  },
  skeptic: {
    label: 'Skeptic',
    lens: 'Red team. Hunts for the fatal flaw, hidden costs, wishful assumptions and the ways this fails.',
    model: 'openai/gpt-6.1-sol',
  },
  builder: {
    label: 'Builder',
    lens: 'Practical maker. Feasibility, the smallest version that proves it, what it takes in time, money and skill.',
    model: 'google/gemini-4-argon',
  },
  market: {
    label: 'Market',
    lens: 'The people it is for. Who wants this, how badly, what they use today, and whether anyone would pay or switch.',
    model: 'x-ai/grok-4.7',
  },
  wildcard: {
    label: 'Wildcard',
    lens: 'Lateral thinker. Adjacent opportunities, unusual angles, a better version of the idea nobody has mentioned.',
    model: 'moonshotai/kimi-k3.1-pro',
  },
};

/** Seats that also do the web research (one question set each). */
export const RESEARCHERS: MemberSeat[] = ['builder', 'skeptic'];

const overrides = z.partialRecord(z.enum(SEATS), z.string().min(3));

/** The roster with COUNCIL_MODELS applied; a malformed override is ignored, not fatal. Pure. */
export function rosterFrom(raw: string | undefined): Record<Seat, SeatInfo> {
  let parsed: Partial<Record<Seat, string>> = {};
  if (raw) {
    try {
      parsed = overrides.parse(JSON.parse(raw));
    } catch {
      console.warn('COUNCIL_MODELS is not valid JSON {seat: model}; using the default roster');
    }
  }
  return Object.fromEntries(
    SEATS.map((seat) => [seat, { ...DEFAULT_ROSTER[seat], model: parsed[seat] ?? DEFAULT_ROSTER[seat].model }]),
  ) as Record<Seat, SeatInfo>;
}

/** Letters the members see each other as, so a brand name doesn't win the argument. */
export const LETTER: Record<MemberSeat, string> = { skeptic: 'A', builder: 'B', market: 'C', wildcard: 'D' };
