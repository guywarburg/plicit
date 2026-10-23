import { describe, it, expect } from 'vitest';
import { groupByGap } from './grouping.js';

const minute = 60 * 1000;

describe('groupByGap', () => {
  it('returns one group when all messages are within gap', () => {
    const msgs = [{ ts: 0 }, { ts: 10 * minute }, { ts: 50 * minute }];
    expect(groupByGap(msgs, 60 * minute)).toEqual([msgs]);
  });

  it('splits into multiple groups when adjacent gap ≥ gapMs', () => {
    const msgs = [
      { ts: 10 * minute },
      { ts: 11 * minute },
      { ts: 80 * minute },
      { ts: 81 * minute },
    ];
    const groups = groupByGap(msgs, 60 * minute);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(2);
  });

  it('returns empty array when given no messages', () => {
    expect(groupByGap([], 60 * minute)).toEqual([]);
  });

  it('treats exact boundary (gap === gapMs) as a split', () => {
    const msgs = [{ ts: 0 }, { ts: 60 * minute }];
    expect(groupByGap(msgs, 60 * minute)).toEqual([[{ ts: 0 }], [{ ts: 60 * minute }]]);
  });
});
