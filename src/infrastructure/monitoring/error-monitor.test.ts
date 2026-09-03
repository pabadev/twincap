import { describe, expect, it, vi } from 'vitest';
import {
  computeFingerprint,
  normalizeStack,
  reportError,
} from './error-monitor';
import type { ErrorReporter, ErrorEventInput } from '../../core/application/ports';
import type { AlertDispatcher } from './error-alerter';

describe('computeFingerprint', () => {
  it('is deterministic: same inputs → same hash', () => {
    const a = computeFingerprint({ name: 'Error', message: 'boom', code: 'ERR', stack: 'at x (file.js:1:2)' });
    const b = computeFingerprint({ name: 'Error', message: 'boom', code: 'ERR', stack: 'at x (file.js:1:2)' });
    expect(a).toBe(b);
    expect(a.startsWith('err_')).toBe(true);
  });

  it('collapses line/column variations to the same fingerprint', () => {
    const a = computeFingerprint({ message: 'boom', stack: 'at foo (/app/src/a.ts:10:5)\nat bar' });
    const b = computeFingerprint({ message: 'boom', stack: 'at foo (/app/src/a.ts:999:88)\nat bar' });
    expect(a).toBe(b);
  });

  it('collapses absolute-path / file:// / webpack variations', () => {
    const a = computeFingerprint({ message: 'boom', stack: 'at foo (file:///app/src/a.ts:1:1)' });
    const b = computeFingerprint({ message: 'boom', stack: 'at foo (webpack:///./src/a.ts:1:1)' });
    expect(a).toBe(b);
  });

  it('yields different hashes for different exceptions', () => {
    const a = computeFingerprint({ message: 'boom', stack: 'at foo' });
    const b = computeFingerprint({ message: 'band', stack: 'at foo' });
    expect(a).not.toBe(b);
  });

  it('uses the primary stack frame; different frames → different hash even if message matches', () => {
    const a = computeFingerprint({ message: 'boom', stack: 'at foo (/a.ts:1:1)' });
    const b = computeFingerprint({ message: 'boom', stack: 'at bar (/b.ts:1:1)' });
    expect(a).not.toBe(b);
  });
});

describe('normalizeStack', () => {
  it('keeps only the first few lines and strips line:col', () => {
    const lines = ['at a (x.ts:1:2)', 'at b (y.ts:3:4)', 'at c (z.ts:5:6)', 'at d (w.ts:7:8)'];
    const out = normalizeStack(lines.join('\n'));
    expect(out).not.toContain(':1:2');
    expect(out).not.toContain('at d');
    expect(out.split('\n').length).toBeLessThanOrEqual(3);
  });

  it('handles empty/undefined', () => {
    expect(normalizeStack(undefined)).toBe('');
    expect(normalizeStack('')).toBe('');
  });
});

type ReportInput = Parameters<typeof reportError>[0];

function makeReporter(impl: ErrorReporter['report']): {
  reporter: ErrorReporter;
  calls: ErrorEventInput[];
} {
  const calls: ErrorEventInput[] = [];
  const reporter: ErrorReporter = {
    report: vi.fn(async (input: ErrorEventInput) => {
      calls.push(input);
      return impl(input);
    }),
  };
  return { reporter, calls };
}

const baseInput: ReportInput = {
  message: 'boom',
  severity: 'error',
  expected: false,
};

describe('reportError (with injected reporter — bypasses env gate)', () => {
  it('persists and returns isFirst/occurrenceCount', async () => {
    const { reporter, calls } = makeReporter(async () => ({ isFirst: true, occurrenceCount: 1 }));
    const noopAlerter: AlertDispatcher = async () => {};

    const result = await reportError(baseInput, {
      reporter,
      alerter: noopAlerter,
      environment: 'test',
      release: 'r1',
    });

    expect(result).toEqual({ isFirst: true, occurrenceCount: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].message).toBe('boom');
    expect(calls[0].fingerprint).toBeDefined();
    expect(calls[0].environment).toBe('test');
    expect(calls[0].release).toBe('r1');
  });

  it('alerts only on first + unexpected + fatal|error', async () => {
    const alerter = vi.fn<AlertDispatcher>(async () => {});
    const { reporter } = makeReporter(async () => ({ isFirst: true, occurrenceCount: 1 }));

    await reportError({ ...baseInput, severity: 'error', expected: false }, { reporter, alerter });
    expect(alerter).toHaveBeenCalledTimes(1);

    alerter.mockClear();
    await reportError({ ...baseInput, severity: 'error', expected: true }, { reporter, alerter });
    expect(alerter).not.toHaveBeenCalled();

    alerter.mockClear();
    await reportError({ ...baseInput, severity: 'warning', expected: false }, { reporter, alerter });
    expect(alerter).not.toHaveBeenCalled();
  });

  it('does not alert on repeated (non-first) occurrences', async () => {
    const alerter = vi.fn<AlertDispatcher>(async () => {});
    const { reporter } = makeReporter(async () => ({ isFirst: false, occurrenceCount: 3 }));

    await reportError(baseInput, { reporter, alerter });
    expect(alerter).not.toHaveBeenCalled();
  });

  it('is fail-safe: a throwing reporter/alerter never propagates', async () => {
    const throwingReporter: ErrorReporter = {
      report: async () => { throw new Error('db down'); },
    };
    const failingAlerter: AlertDispatcher = async () => { throw new Error('smtp down'); };
    const okReporter: ErrorReporter = {
      report: async () => { throw new Error('db down 2'); },
    };

    // reporter throws → reportError returns null, does not throw.
    await expect(reportError(baseInput, { reporter: throwingReporter })).resolves.toBeNull();

    // alerter throws (only called on first+unexpected+error) → still resolves.
    const { reporter } = makeReporter(async () => ({ isFirst: true, occurrenceCount: 1 }));
    await expect(
      reportError(baseInput, { reporter, alerter: failingAlerter }),
    ).resolves.toEqual({ isFirst: true, occurrenceCount: 1 });

    await expect(reportError(baseInput, { reporter: okReporter })).resolves.toBeNull();
  });

  it('returns null (silent) when monitoring disabled and no reporter injected', async () => {
    const prev = process.env.ERROR_MONITORING_ENABLED;
    process.env.ERROR_MONITORING_ENABLED = 'false';
    try {
      // No reporter injected → respects env gate. No DB is touched (gate short-circuits).
      const result = await reportError(baseInput);
      expect(result).toBeNull();
    } finally {
      process.env.ERROR_MONITORING_ENABLED = prev;
    }
  });
});
