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

  describe('current_month at the UTC-5 civil boundary (A2)', () => {
    it('keeps the civil-month movements when the UTC instant already rolled over', () => {
      // 2026-09-01T02:00:00Z = Aug 31 21:00 local in UTC-5 (tzOffsetMinutes
      // 300): the current month is still August, even though UTC says
      // September. Without the offset shift this returned only the Sep 1
      // movement — the A2 bug.
      const result = filterMovementsByPeriod(
        [movement('2026-08-31'), movement('2026-09-01')],
        'current_month',
        new Date('2026-09-01T02:00:00Z'),
        300,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-08-31']);
    });

    it('keeps August movements for the spec-literal 2026-08-31T02:00:00Z instant', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-08-31'), movement('2026-09-01')],
        'current_month',
        new Date('2026-08-31T02:00:00Z'),
        300,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-08-31']);
    });

    it('keeps the civil-month movements on the Sep 1 boundary morning', () => {
      // 2026-09-01T03:00:00Z + offset 300 = Aug 31 22:00 local — still August.
      const result = filterMovementsByPeriod(
        [movement('2026-08-31'), movement('2026-09-01')],
        'current_month',
        new Date('2026-09-01T03:00:00Z'),
        300,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-08-31']);
    });
  });

  describe('this_year at the UTC-5 civil boundary (A2)', () => {
    it('keeps the civil-year movements when the UTC instant already rolled over', () => {
      // 2027-01-01T02:00:00Z = Dec 31 21:00 local in UTC-5: civil year 2026.
      const result = filterMovementsByPeriod(
        [movement('2026-12-31'), movement('2027-01-01')],
        'this_year',
        new Date('2027-01-01T02:00:00Z'),
        300,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-12-31']);
    });
  });
});