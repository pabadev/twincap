import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  computeFingerprint,
  normalizeStack,
  reportError,
  withAlertCooldownTimeout,
} from './error-monitor';
import type { ErrorReporter, ErrorEventInput } from '../../core/application/ports';
import type { AlertDispatcher } from './error-alerter';
import { RateLimitModel } from '../models/rate-limit';

/**
 * Fake alert-cooldown gate injected into tests that exercise the alert path:
 * always allows, so the case under test is the throttle gate is OPEN. The
 * alert-throttle behavior itself is covered by dedicated tests below.
 */
const allowAlertCooldown = async (): Promise<{ allowed: boolean }> => ({
  allowed: true,
});

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
      alertCooldown: allowAlertCooldown,
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

    await reportError(
      { ...baseInput, severity: 'error', expected: false },
      { reporter, alerter, alertCooldown: allowAlertCooldown },
    );
    expect(alerter).toHaveBeenCalledTimes(1);

    alerter.mockClear();
    await reportError(
      { ...baseInput, severity: 'error', expected: true },
      { reporter, alerter, alertCooldown: allowAlertCooldown },
    );
    expect(alerter).not.toHaveBeenCalled();

    alerter.mockClear();
    await reportError(
      { ...baseInput, severity: 'warning', expected: false },
      { reporter, alerter, alertCooldown: allowAlertCooldown },
    );
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
      reportError(baseInput, {
        reporter,
        alerter: failingAlerter,
        alertCooldown: allowAlertCooldown,
      }),
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

describe('reportError alert throttle (R14-G §6)', () => {
  it('alerts on the first isFirst but suppresses the second isFirst of the SAME fingerprint', async () => {
    const alerter = vi.fn<AlertDispatcher>(async () => {});
    let allow = true;
    const alertCooldown = async (): Promise<{ allowed: boolean }> => ({
      allowed: allow,
    });
    const { reporter } = makeReporter(async () => ({ isFirst: true, occurrenceCount: 1 }));

    // First isFirst of this fingerprint — the throttle gate is open → alert.
    await reportError(
      { ...baseInput, message: 'throttled-boom' },
      { reporter, alerter, alertCooldown },
    );
    expect(alerter).toHaveBeenCalledTimes(1);

    // SAME fingerprint, another isFirst, still inside the window → NO alert.
    allow = false;
    await reportError(
      { ...baseInput, message: 'throttled-boom' },
      { reporter, alerter, alertCooldown },
    );
    expect(alerter).toHaveBeenCalledTimes(1);

    // A DIFFERENT fingerprint is a different cooldown key → alert fires again.
    allow = true;
    await reportError(
      { ...baseInput, message: 'throttled-other' },
      { reporter, alerter, alertCooldown },
    );
    expect(alerter).toHaveBeenCalledTimes(2);
  });

  it('keeps the persisted result when the alert is throttled', async () => {
    const alerter = vi.fn<AlertDispatcher>(async () => {});
    const alertCooldown = async (): Promise<{ allowed: boolean }> => ({
      allowed: false,
    });
    const { reporter } = makeReporter(async () => ({ isFirst: true, occurrenceCount: 4 }));

    const result = await reportError(
      { ...baseInput, message: 'quiet-boom' },
      { reporter, alerter, alertCooldown },
    );

    // No email, but persistence happened and the reporter result is returned.
    expect(alerter).not.toHaveBeenCalled();
    expect(result).toEqual({ isFirst: true, occurrenceCount: 4 });
    expect(reporter.report).toHaveBeenCalledTimes(1);
  });

  it('fails CLOSED when the cooldown check throws: the alert is suppressed', async () => {
    const alerter = vi.fn<AlertDispatcher>(async () => {});
    const alertCooldown = async (): Promise<{ allowed: boolean }> => {
      throw new Error('cooldown backend down');
    };
    const { reporter } = makeReporter(async () => ({ isFirst: true, occurrenceCount: 1 }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      reportError(
        { ...baseInput, message: 'failclosed-boom' },
        { reporter, alerter, alertCooldown },
      ),
    ).resolves.toEqual({ isFirst: true, occurrenceCount: 1 });
    // FAIL-CLOSED: cooldown backend down → suppress, do NOT alert.
    expect(alerter).not.toHaveBeenCalled();
    // Observability log emitted.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('monitor_alert_suppressed'),
    );
    errorSpy.mockRestore();
  });

  it('suppresses alert when cooldown is slow (timeout path)', async () => {
    const alerter = vi.fn<AlertDispatcher>(async () => {});
    const alertCooldown = async (): Promise<{ allowed: boolean }> => {
      // Simulate a slow DB query — resolves after 200 ms.
      await new Promise((r) => setTimeout(r, 200));
      return { allowed: true };
    };
    const { reporter } = makeReporter(async () => ({ isFirst: true, occurrenceCount: 1 }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await reportError(
      { ...baseInput, message: 'slow-cooldown-boom' },
      { reporter, alerter, alertCooldown, alertCooldownTimeoutMs: 20 },
    );
    // The timeout fires first → fail-closed → no alert.
    expect(alerter).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe(
  'alert throttle integration with the real monitorAlertRateLimiter',
  () => {
    let mongod: MongoMemoryServer;

    beforeAll(async () => {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri('twincap_alert_cooldown'));
      // Unique index on `key` must exist for the rate limiter's atomic path.
      await RateLimitModel.init();
    }, 60_000);

    afterAll(async () => {
      await mongoose.disconnect();
      await mongod.stop();
    }, 60_000);

    beforeEach(async () => {
      await RateLimitModel.deleteMany({});
    });

    it('default cooldown allows one alert per fingerprint per 30 min', async () => {
      const alerter = vi.fn<AlertDispatcher>(async () => {});
      const { reporter } = makeReporter(async () => ({ isFirst: true, occurrenceCount: 1 }));

      // NO alertCooldown injected → production default
      // (monitorAlertRateLimiter, 30-min window). First check consumes the
      // single allowed attempt → alert.
      await reportError(
        { ...baseInput, message: 'integration-boom' },
        { reporter, alerter, environment: 'test', release: 'r1' },
      );
      expect(alerter).toHaveBeenCalledTimes(1);

      // Same fingerprint, still inside the 30-min window → second check is
      // blocked → NO alert.
      await reportError(
        { ...baseInput, message: 'integration-boom' },
        { reporter, alerter, environment: 'test', release: 'r1' },
      );
      expect(alerter).toHaveBeenCalledTimes(1);

      // Different fingerprint → fresh cooldown key → alert fires again.
      await reportError(
        { ...baseInput, message: 'integration-other' },
        { reporter, alerter, environment: 'test', release: 'r1' },
      );
      expect(alerter).toHaveBeenCalledTimes(2);
    });
  },
  60_000,
);

describe('withAlertCooldownTimeout', () => {
  it('resolves the check result when it completes before the timeout', async () => {
    const check = async (): Promise<{ allowed: boolean }> => ({ allowed: true });
    const result = await withAlertCooldownTimeout(check, 1000, { allowed: false });
    expect(result).toEqual({ allowed: true });
  });

  it('returns fallback when the check rejects (fail-closed)', async () => {
    const check = async (): Promise<{ allowed: boolean }> => {
      throw new Error('db down');
    };
    const result = await withAlertCooldownTimeout(check, 1000, { allowed: false });
    expect(result).toEqual({ allowed: false });
  });

  it('returns fallback when the check takes longer than timeoutMs (fail-closed)', async () => {
    const check = async (): Promise<{ allowed: boolean }> => {
      await new Promise((r) => setTimeout(r, 200));
      return { allowed: true };
    };
    const result = await withAlertCooldownTimeout(check, 20, { allowed: false });
    expect(result).toEqual({ allowed: false });
  });

  it('does not produce an unhandled rejection when the check rejects after timeout', async () => {
    const rejections: unknown[] = [];
    const handler = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', handler);

    const check = async (): Promise<{ allowed: boolean }> => {
      await new Promise((r) => setTimeout(r, 50));
      throw new Error('late failure');
    };
    const result = await withAlertCooldownTimeout(check, 10, { allowed: false });
    expect(result).toEqual({ allowed: false });

    // Give the late rejection a tick to propagate.
    await new Promise((r) => setTimeout(r, 100));
    expect(rejections).toHaveLength(0);
    process.removeListener('unhandledRejection', handler);
  });
});
