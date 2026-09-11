import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claimIdempotency, releaseIdempotency } from './idempotency';

// Mock the IdempotencyModel
vi.mock('../models/idempotency', () => ({
  IdempotencyModel: {
    create: vi.fn(),
    deleteOne: vi.fn(),
  },
}));

import { IdempotencyModel } from '../models/idempotency';
import type { IdempotencyDocument } from '../models/idempotency';

describe('idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('claimIdempotency', () => {
    it('claims a new key and returns true', async () => {
      vi.mocked(IdempotencyModel.create).mockResolvedValue([] as IdempotencyDocument[]);

      const result = await claimIdempotency('user-1', 'key-abc', 'createSale');

      expect(result).toBe(true);
      expect(IdempotencyModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          key: 'key-abc',
          action: 'createSale',
        })
      );
    });

    it('returns false on duplicate key (E11000)', async () => {
      const dupError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      vi.mocked(IdempotencyModel.create).mockRejectedValue(dupError);

      const result = await claimIdempotency('user-1', 'key-abc', 'createSale');

      expect(result).toBe(false);
    });

    it('throws on non-duplicate errors (fails closed)', async () => {
      vi.mocked(IdempotencyModel.create).mockRejectedValue(new Error('transient failure'));

      await expect(
        claimIdempotency('user-1', 'key-abc', 'createSale')
      ).rejects.toThrow('transient failure');
    });

    it('throws when key is missing/null — §19 mandatory key policy', async () => {
      await expect(
        claimIdempotency('user-1', null, 'createSale'),
      ).rejects.toThrow('Idempotency key is required');
      await expect(
        claimIdempotency('user-1', '', 'createSale'),
      ).rejects.toThrow('Idempotency key is required');
      expect(IdempotencyModel.create).not.toHaveBeenCalled();
    });

    it('trims whitespace around the key', async () => {
      vi.mocked(IdempotencyModel.create).mockResolvedValue([] as IdempotencyDocument[]);

      await claimIdempotency('user-1', '  key-abc  ', 'createSale');

      expect(IdempotencyModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'key-abc' })
      );
    });
  });

  describe('releaseIdempotency', () => {
    it('deletes the key record for a given scope', async () => {
      vi.mocked(IdempotencyModel.deleteOne).mockResolvedValue({ acknowledged: true, deletedCount: 1 });

      await releaseIdempotency('user-1', 'key-abc', 'createSale');

      expect(IdempotencyModel.deleteOne).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'createSale',
        key: 'key-abc',
      });
    });

    it('no-ops when key is missing', async () => {
      await releaseIdempotency('user-1', null, 'createSale');
      expect(IdempotencyModel.deleteOne).not.toHaveBeenCalled();
    });
  });

  describe('retry cycle (R15.3 §25)', () => {
    it('claim → release → claim again with the SAME key succeeds (retry does not duplicate)', async () => {
      const createdDocs: Array<{ userId: string; action: string; key: string }> = [];
      vi.mocked(IdempotencyModel.create).mockImplementation(async (doc) => {
        createdDocs.push(doc as { userId: string; action: string; key: string });
        return [doc] as unknown as IdempotencyDocument[];
      });

      // First attempt: claim succeeds, action runs, then the action FAILS and
      // the caller releases the key so the retry is allowed.
      expect(await claimIdempotency('user-1', 'key-retry', 'createSale')).toBe(true);
      await releaseIdempotency('user-1', 'key-retry', 'createSale');

      // Retry with the SAME key: claim succeeds again (record was released),
      // proving the retry re-runs instead of silently returning a stale outcome.
      expect(await claimIdempotency('user-1', 'key-retry', 'createSale')).toBe(true);
      expect(createdDocs).toHaveLength(2);

      // And WITHOUT the release, the duplicate is still rejected (idempotency
      // preserved): the contract holds both ways.
      vi.mocked(IdempotencyModel.create).mockRejectedValue(
        Object.assign(new Error('E11000 duplicate key'), { code: 11000 }),
      );
      expect(await claimIdempotency('user-1', 'key-retry', 'createSale')).toBe(false);
    });
  });
});
