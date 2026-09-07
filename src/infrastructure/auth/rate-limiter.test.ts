import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MongoRateLimiter, monitorAlertRateLimiter } from './rate-limiter';

// Mock the RateLimitModel with the atomic API used by check() (R14-C §5):
// findOneAndUpdate ($inc path), deleteOne (stale cleanup), create (fresh
// window) and deleteMany (reset). The old findOne → save() races are gone.
vi.mock('../models/rate-limit', () => ({
  RateLimitModel: {
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

import { RateLimitModel } from '../models/rate-limit';
import type { RateLimitDocument } from '../models/rate-limit';

describe('MongoRateLimiter', () => {
  let rateLimiter: MongoRateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter = new MongoRateLimiter({
      maxAttempts: 3,
      windowMs: 60 * 1000, // 1 minute for testing
    });
  });

  describe('check', () => {
    it('allows first attempt and creates new entry (findOneAndUpdate null → deleteOne + create)', async () => {
      vi.mocked(RateLimitModel.findOneAndUpdate).mockResolvedValue(null);
      vi.mocked(RateLimitModel.deleteOne).mockResolvedValue({ acknowledged: true, deletedCount: 0 });
      vi.mocked(RateLimitModel.create).mockResolvedValue([] as RateLimitDocument[]);

      const result = await rateLimiter.check('test:key');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(1);
      expect(RateLimitModel.deleteOne).toHaveBeenCalledWith({
        key: 'test:key',
        windowStart: { $lt: expect.any(Date) },
      });
      expect(RateLimitModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'test:key',
          attempts: 1,
        }),
      );
    });

    it('increments attempts for existing entry within window — allowed under max', async () => {
      // findOneAndUpdate(new: true) returns the doc AFTER the $inc → attempts+1.
      const activeEntry = {
        key: 'test:key',
        attempts: 3,
        windowStart: new Date(),
        expiresAt: new Date(Date.now() + 30_000),
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(RateLimitModel.findOneAndUpdate).mockResolvedValue(activeEntry as RateLimitDocument);

      const result = await rateLimiter.check('test:key');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(3);
      // The $inc happened on the document returned by findOneAndUpdate — no
      // separate save() call exists anymore (atomic path).
      expect(RateLimitModel.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'test:key', windowStart: { $gte: expect.any(Date) } },
        { $inc: { attempts: 1 } },
        { new: true },
      );
      expect(activeEntry.save).not.toHaveBeenCalled();
    });

    it('blocks when attempts exceed max', async () => {
      const activeEntry = {
        key: 'test:key',
        attempts: 4, // Already above max (3)
        windowStart: new Date(),
        expiresAt: new Date(Date.now() + 30_000),
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(RateLimitModel.findOneAndUpdate).mockResolvedValue(activeEntry as RateLimitDocument);

      const result = await rateLimiter.check('test:key');

      expect(result.allowed).toBe(false);
      expect(result.attempts).toBe(4);
    });

    it('resets the window when the existing entry is stale', async () => {
      vi.mocked(RateLimitModel.findOneAndUpdate).mockResolvedValue(null);
      vi.mocked(RateLimitModel.deleteOne).mockResolvedValue({ acknowledged: true, deletedCount: 1 });
      vi.mocked(RateLimitModel.create).mockResolvedValue([] as RateLimitDocument[]);

      const result = await rateLimiter.check('stale:key');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(1);
      expect(RateLimitModel.deleteOne).toHaveBeenCalledWith({
        key: 'stale:key',
        windowStart: { $lt: expect.any(Date) },
      });
      expect(RateLimitModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'stale:key',
          attempts: 1,
        }),
      );
    });

    it('retries once when create throws duplicate-key (E11000) and returns the retry-path result', async () => {
      // First findOneAndUpdate: no active window → deleteOne + create path.
      vi.mocked(RateLimitModel.findOneAndUpdate)
        .mockResolvedValueOnce(null) // create → throws E11000 (concurrent loser)
        .mockResolvedValueOnce({
          key: 'test:key',
          attempts: 4,
          windowStart: new Date(),
          expiresAt: new Date(Date.now() + 30_000),
        } as RateLimitDocument); // retry hits the active-window $inc path
      vi.mocked(RateLimitModel.deleteOne).mockResolvedValue({ acknowledged: true, deletedCount: 0 });
      vi.mocked(RateLimitModel.create).mockRejectedValue(new Error('E11000 duplicate key error'));

      const result = await rateLimiter.check('test:key');

      // The result MUST come from the retry (second findOneAndUpdate), not
      // from the failed create.
      expect(RateLimitModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(RateLimitModel.deleteOne).toHaveBeenCalledTimes(1);
      expect(RateLimitModel.create).toHaveBeenCalledTimes(1);
      expect(result.attempts).toBe(4);
      expect(result.allowed).toBe(false);
    });
  });

  describe('reset', () => {
    it('deletes all entries for a key', async () => {
      vi.mocked(RateLimitModel.deleteMany).mockResolvedValue({ acknowledged: true, deletedCount: 2 });

      await rateLimiter.reset('test:key');

      expect(RateLimitModel.deleteMany).toHaveBeenCalledWith({ key: 'test:key' });
    });
  });
});

describe('monitorAlertRateLimiter (R14-G §6)', () => {
  it('allows the first check and blocks the second within the 30-min window', async () => {
    const key = 'monitor-alert:err_abc123';

    // First check: no active window → deleteOne + create path → attempts 1.
    vi.mocked(RateLimitModel.findOneAndUpdate).mockResolvedValueOnce(null);
    vi.mocked(RateLimitModel.deleteOne).mockResolvedValue({ acknowledged: true, deletedCount: 0 });
    vi.mocked(RateLimitModel.create).mockResolvedValue([] as RateLimitDocument[]);

    const first = await monitorAlertRateLimiter.check(key);
    expect(first.allowed).toBe(true);
    expect(first.attempts).toBe(1);

    // Second check: active window with attempts 2 (> maxAttempts 1) → blocked.
    const activeEntry = {
      key,
      attempts: 2,
      windowStart: new Date(),
      expiresAt: new Date(Date.now() + 30_000),
    };
    vi.mocked(RateLimitModel.findOneAndUpdate).mockResolvedValueOnce(activeEntry as RateLimitDocument);

    const second = await monitorAlertRateLimiter.check(key);
    expect(second.allowed).toBe(false);
    expect(second.attempts).toBe(2);
    // The $inc ran against the SAME key (check-and-consume semantics: the
    // first call both checks AND marks, no separate has/mark pair).
    expect(RateLimitModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key, windowStart: { $gte: expect.any(Date) } },
      { $inc: { attempts: 1 } },
      { new: true },
    );
  });
});