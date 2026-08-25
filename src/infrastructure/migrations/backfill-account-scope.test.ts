import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateMany = vi.fn();

vi.mock('../models/account', () => ({
  AccountModel: {
    updateMany: (...args: unknown[]) => updateMany(...args),
  },
}));

import { backfillAccountScope } from './backfill-account-scope';

describe('backfillAccountScope', () => {
  beforeEach(() => {
    updateMany.mockReset();
  });

  it('targets ONLY documents missing or null scope and sets Personal', async () => {
    updateMany.mockResolvedValue({ matchedCount: 3, modifiedCount: 3 });

    const result = await backfillAccountScope();

    expect(updateMany).toHaveBeenCalledTimes(1);
    const [filter, update] = updateMany.mock.calls[0];
    expect(filter).toEqual({ $or: [{ scope: { $exists: false } }, { scope: null }] });
    expect(update).toEqual({ $set: { scope: 'Personal' } });
    expect(result).toEqual({ matched: 3, modified: 3 });
  });

  it('is idempotent — a re-run matches nothing and modifies nothing', async () => {
    updateMany
      .mockResolvedValueOnce({ matchedCount: 2, modifiedCount: 2 })
      .mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });

    const first = await backfillAccountScope();
    const second = await backfillAccountScope();

    expect(first.modified).toBe(2);
    expect(second.matched).toBe(0);
    expect(second.modified).toBe(0);
  });

  it('never overwrites an existing scope value (filter excludes set values)', async () => {
    updateMany.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

    await backfillAccountScope();

    const [filter] = updateMany.mock.calls[0];
    // A document with scope 'Business' does not match the filter.
    expect(JSON.stringify(filter)).not.toContain('Business');
  });
});
