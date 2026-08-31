import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MongoRateLimiter } from './rate-limiter';

// Mock the RateLimitModel
vi.mock('../models/rate-limit', () => ({
  RateLimitModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

import { RateLimitModel } from '../models/rate-limit';

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
    it('allows first attempt and creates new entry', async () => {
      vi.mocked(RateLimitModel.findOne).mockResolvedValue(null);
      vi.mocked(RateLimitModel.create).mockResolvedValue({} as any);

      const result = await rateLimiter.check('test:key');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(1);
      expect(RateLimitModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'test:key',
          attempts: 1,
        })
      );
    });

    it('increments attempts for existing entry within window', async () => {
      const existingEntry = {
        key: 'test:key',
        attempts: 2,
        windowStart: new Date(),
        expiresAt: new Date(),
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(RateLimitModel.findOne).mockResolvedValue(existingEntry as any);

      const result = await rateLimiter.check('test:key');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(3);
      expect(existingEntry.save).toHaveBeenCalled();
    });

    it('blocks when max attempts exceeded', async () => {
      const existingEntry = {
        key: 'test:key',
        attempts: 3, // Already at max
        windowStart: new Date(),
        expiresAt: new Date(),
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(RateLimitModel.findOne).mockResolvedValue(existingEntry as any);

      const result = await rateLimiter.check('test:key');

      expect(result.allowed).toBe(false);
      expect(result.attempts).toBe(4);
    });

    it('resets window when no existing entry found', async () => {
      vi.mocked(RateLimitModel.findOne).mockResolvedValue(null);
      vi.mocked(RateLimitModel.create).mockResolvedValue({} as any);

      const result = await rateLimiter.check('new:key');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(1);
      expect(RateLimitModel.create).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('deletes all entries for a key', async () => {
      vi.mocked(RateLimitModel.deleteMany).mockResolvedValue({ deletedCount: 2 } as any);

      await rateLimiter.reset('test:key');

      expect(RateLimitModel.deleteMany).toHaveBeenCalledWith({ key: 'test:key' });
    });
  });
});
