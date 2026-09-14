import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LOGIN_FAILURE_THRESHOLD,
  LOGIN_FAILURE_WINDOW_MS,
  EMAIL_LOCKOUT_MS,
  LOGIN_ATTEMPT_TTL_MS,
  normalizeEmail,
  recordLoginFailure,
  resetLoginFailures,
  isEmailLockedOut,
  getLockoutRemaining,
} from './login-attempts';
import type { Clock } from '../../core/application/ports';

// Mock the model with the query surface the helper uses (R15.3.2 P2-5):
// aggregate (failure window read — single atomic roundtrip), create (append
// attempt), deleteMany (reset). Window/lockout MATH is what these unit tests
// cover; the TTL index itself is MongoDB's job and is not unit-testable.
vi.mock('../models/login-attempt', () => ({
  LoginAttemptModel: {
    aggregate: vi.fn(),
    create: vi.fn(),
    // deleteMany().exec() — the helper awaits the query executor.
    deleteMany: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue({}) }),
  },
}));

import { LoginAttemptModel } from '../models/login-attempt';

const T0 = new Date('2026-09-13T10:00:00.000Z');

function clockAt(iso: string): Clock {
  return { now: () => new Date(iso) };
}

/** Mocks the aggregation to answer `count` failures with the given last one. */
function mockWindow(count: number, lastFailureAt: string) {
  vi.mocked(LoginAttemptModel.aggregate).mockReturnValue({
    exec: vi.fn().mockResolvedValue([
      { _id: null, count, lastFailureAt: new Date(lastFailureAt) },
    ]),
  } as never);
}

/** Mocks the aggregation to answer an empty window. */
function mockEmptyWindow() {
  vi.mocked(LoginAttemptModel.aggregate).mockReturnValue({
    exec: vi.fn().mockResolvedValue([]),
  } as never);
}

describe('login-attempts (R15.3.2 P2-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeEmail', () => {
    it('trims and lowercases the lockout key', () => {
      expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
    });
  });

  describe('recordLoginFailure', () => {
    it('stores createdAt and expiresAt (now + 24h TTL) from the injected clock', async () => {
      await recordLoginFailure('User@Example.com', '1.2.3.4', clockAt(T0.toISOString()));

      expect(LoginAttemptModel.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        ip: '1.2.3.4',
        createdAt: T0,
        expiresAt: new Date(T0.getTime() + LOGIN_ATTEMPT_TTL_MS),
      });
    });
  });

  describe('resetLoginFailures', () => {
    it('deletes the email history by the NORMALIZED email', async () => {
      await resetLoginFailures('  USER@Example.COM ');

      expect(LoginAttemptModel.deleteMany).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
    });
  });

  describe('lockout math', () => {
    it('not locked below the threshold (4 failures)', async () => {
      mockWindow(LOGIN_FAILURE_THRESHOLD - 1, '2026-09-13T09:55:00.000Z');

      const remaining = await getLockoutRemaining('user@example.com', clockAt(T0.toISOString()));

      expect(remaining).toBe(0);
      expect(await isEmailLockedOut('user@example.com', clockAt(T0.toISOString()))).toBe(false);
    });

    it('locked at exactly the threshold: 30 min from the LAST failure', async () => {
      // Last failure 1 minute ago → 29 minutes still locked.
      mockWindow(LOGIN_FAILURE_THRESHOLD, '2026-09-13T09:59:00.000Z');

      const remaining = await getLockoutRemaining('user@example.com', clockAt(T0.toISOString()));

      expect(remaining).toBe(EMAIL_LOCKOUT_MS - 60_000);
      expect(await isEmailLockedOut('user@example.com', clockAt(T0.toISOString()))).toBe(true);
    });

    it('every new failure while locked stretches the lockout back to 30 min', async () => {
      mockWindow(LOGIN_FAILURE_THRESHOLD, T0.toISOString());

      const remaining = await getLockoutRemaining('user@example.com', clockAt(T0.toISOString()));

      expect(remaining).toBe(EMAIL_LOCKOUT_MS);
    });

    it('lockout expires after the 30-minute window (remaining clamps at 0)', async () => {
      // Last failure exactly 30 minutes before now → lockout already over.
      mockWindow(LOGIN_FAILURE_THRESHOLD, '2026-09-13T09:30:00.000Z');

      const remaining = await getLockoutRemaining('user@example.com', clockAt(T0.toISOString()));

      expect(remaining).toBe(0);
      expect(await isEmailLockedOut('user@example.com', clockAt(T0.toISOString()))).toBe(false);
    });

    it('scans the rolling 60-minute window from now (older failures excluded by the $match)', async () => {
      mockWindow(LOGIN_FAILURE_THRESHOLD, '2026-09-13T09:59:00.000Z');
      await getLockoutRemaining('user@example.com', clockAt(T0.toISOString()));

      const [pipeline] = vi.mocked(LoginAttemptModel.aggregate).mock.calls[0];
      const match = (pipeline[0] as {
        $match: { email: string; createdAt: { $gte: Date } };
      }).$match;
      expect(match.email).toBe('user@example.com');
      expect(match.createdAt.$gte).toEqual(new Date(T0.getTime() - LOGIN_FAILURE_WINDOW_MS));
    });

    it('no failures at all → never locked', async () => {
      mockEmptyWindow();

      expect(await getLockoutRemaining('user@example.com', clockAt(T0.toISOString()))).toBe(0);
      expect(await isEmailLockedOut('user@example.com', clockAt(T0.toISOString()))).toBe(false);
    });
  });
});