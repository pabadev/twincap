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

describe('idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('claimIdempotency', () => {
    it('claims a new key and returns true', async () => {
      vi.mocked(IdempotencyModel.create).mockResolvedValue({} as any);

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

    it('allows when key is missing/null (backward compat)', async () => {
      const result = await claimIdempotency('user-1', null, 'createSale');
      expect(result).toBe(true);
      expect(IdempotencyModel.create).not.toHaveBeenCalled();
    });

    it('trims whitespace around the key', async () => {
      vi.mocked(IdempotencyModel.create).mockResolvedValue({} as any);

      await claimIdempotency('user-1', '  key-abc  ', 'createSale');

      expect(IdempotencyModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'key-abc' })
      );
    });
  });

  describe('releaseIdempotency', () => {
    it('deletes the key record for a given scope', async () => {
      vi.mocked(IdempotencyModel.deleteOne).mockResolvedValue({ deletedCount: 1 } as any);

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
});
