import { describe, expect, it } from 'vitest';
import { filterMovementsByPeriod } from './movement-period-filter';

const NOW = new Date('2026-08-20T12:00:00Z');

function movement(date: string) {
  return { date };
}

describe('filterMovementsByPeriod', () => {
  describe('current_month', () => {
    it('keeps movements in the current UTC year-month', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-08-01'), movement('2026-08-31')],
        'current_month',
        NOW,
      );
      expect(result).toHaveLength(2);
    });

    it('excludes movements from the previous month', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-08-15'), movement('2026-07-31'), movement('2026-07-01')],
        'current_month',
        NOW,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-08-15']);
    });

    it('excludes the same month of the previous year', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-08-10'), movement('2025-08-10')],
        'current_month',
        NOW,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-08-10']);
    });

    it('handles ISO timestamps in addition to plain civil dates', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-08-10T00:00:00.000Z'), movement('2026-08-10T23:59:59.999Z')],
        'current_month',
        NOW,
      );
      expect(result).toHaveLength(2);
    });

    it('returns an empty array when nothing matches', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-06-15')],
        'current_month',
        NOW,
      );
      expect(result).toEqual([]);
    });
  });

  describe('this_year', () => {
    it('keeps movements in the current UTC year', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-01-05'), movement('2026-12-31')],
        'this_year',
        NOW,
      );
      expect(result).toHaveLength(2);
    });

    it('excludes movements from other years', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-06-01'), movement('2025-12-31'), movement('2027-01-01')],
        'this_year',
        NOW,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-06-01']);
    });
  });
});