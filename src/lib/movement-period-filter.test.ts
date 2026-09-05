import { describe, expect, it } from 'vitest';
import { filterMovementsByPeriod, filterMovementsByDateRange } from './movement-period-filter';

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

  describe('previous_month', () => {
    it('includes the last day of the previous month', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-07-31'), movement('2026-08-01'), movement('2026-06-30')],
        'previous_month',
        NOW,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-07-31']);
    });

    it('includes the first day of the previous month', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-07-01'), movement('2026-08-21')],
        'previous_month',
        NOW,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-07-01']);
    });

    it('excludes the first day of the current month', () => {
      const result = filterMovementsByPeriod(
        [movement('2026-08-01'), movement('2026-07-15')],
        'previous_month',
        NOW,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-07-15']);
    });

    it('rolls the year over when the current month is January', () => {
      const result = filterMovementsByPeriod(
        [movement('2025-12-31'), movement('2025-12-01'), movement('2026-01-01')],
        'previous_month',
        new Date('2026-01-15T12:00:00Z'),
      );
      expect(result.map((m) => m.date)).toEqual(['2025-12-31', '2025-12-01']);
    });

    it('derives the previous month from the civil date at the UTC-5 boundary (A2)', () => {
      // 2026-09-01T02:00:00Z = Aug 31 21:00 local in UTC-5: the civil month is
      // still August, so the previous month is July — not August.
      const result = filterMovementsByPeriod(
        [movement('2026-07-31'), movement('2026-08-31'), movement('2026-08-01')],
        'previous_month',
        new Date('2026-09-01T02:00:00Z'),
        300,
      );
      expect(result.map((m) => m.date)).toEqual(['2026-07-31']);
    });
  });

  describe('filterMovementsByDateRange', () => {
    it('keeps everything when no bounds are set', () => {
      const result = filterMovementsByDateRange(
        [movement('2026-08-01'), movement('2026-08-31')],
      );
      expect(result).toHaveLength(2);
    });

    it('from-only: includes the from date (midnight) and excludes earlier', () => {
      const result = filterMovementsByDateRange(
        [movement('2026-08-04'), movement('2026-08-05'), movement('2026-08-31')],
        '2026-08-05',
      );
      expect(result.map((m) => m.date)).toEqual(['2026-08-05', '2026-08-31']);
    });

    it('to-only: includes the to date up to end-of-day and excludes later', () => {
      const result = filterMovementsByDateRange(
        [movement('2026-08-01'), movement('2026-08-10'), movement('2026-08-11')],
        undefined,
        '2026-08-10',
      );
      expect(result.map((m) => m.date)).toEqual(['2026-08-01', '2026-08-10']);
    });

    it('end-of-day inclusive: a midnight-UTC movement of the to date is kept', () => {
      const result = filterMovementsByDateRange(
        [
          { date: '2026-08-10T00:00:00.000Z' },
          { date: '2026-08-11T00:00:00.000Z' },
        ],
        '2026-08-10',
        '2026-08-10',
      );
      expect(result.map((m) => m.date)).toEqual(['2026-08-10T00:00:00.000Z']);
    });

    it('bounded range: keeps only the window between from and to', () => {
      const result = filterMovementsByDateRange(
        [movement('2026-08-01'), movement('2026-08-05'), movement('2026-08-10'), movement('2026-08-20')],
        '2026-08-05',
        '2026-08-10',
      );
      expect(result.map((m) => m.date)).toEqual(['2026-08-05', '2026-08-10']);
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