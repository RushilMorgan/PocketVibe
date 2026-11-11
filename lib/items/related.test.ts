import { describe, expect, it } from 'vitest';
import { pickRelated, RELATED_MIN } from './related';

describe('pickRelated', () => {
  it('takes the closest save at or above the bar', () => {
    expect(
      pickRelated([
        { id: 'a', title: 'A', similarity: 0.81 },
        { id: 'b', title: 'B', similarity: 0.8724 },
      ]),
    ).toEqual({ itemId: 'b', title: 'B', similarity: 0.872 });
  });

  it('ignores saves below the bar (unrelated pairs measured up to 0.77)', () => {
    expect(pickRelated([{ id: 'a', title: 'A', similarity: 0.769 }])).toBeNull();
    expect(pickRelated([{ id: 'a', title: 'A', similarity: RELATED_MIN }])).not.toBeNull();
  });

  it('returns null with nothing to compare', () => {
    expect(pickRelated([])).toBeNull();
  });
});
