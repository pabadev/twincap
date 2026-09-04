import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AnalyticsEventModel so no DB connection is required.
vi.mock('../models/analytics-event', () => ({
  AnalyticsEventModel: {
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));
// A real connection is simulated so the reporter attempts the write.
vi.mock('../db/connection', () => ({
  isDbConnected: vi.fn().mockReturnValue(true),
}));

import { MongoAnalyticsRepository } from './analytics-repository';
import { AnalyticsEventModel } from '../models/analytics-event';
import { isDbConnected } from '../db/connection';
import { Types } from 'mongoose';

const WORKSPACE_ID = '64b8f1a2e4b0b0b0b0b0b001';

// Mimic the exec() chain used with findOneAndUpdate.
function execChain() {
  return {
    exec: vi.fn().mockResolvedValue(null),
  };
}

describe('MongoAnalyticsRepository', () => {
  let repo: MongoAnalyticsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDbConnected).mockReturnValue(true);
    repo = new MongoAnalyticsRepository();
  });

  describe('track (regular events)', () => {
    it('persists via AnalyticsEventModel.create', async () => {
      vi.mocked(AnalyticsEventModel.create).mockResolvedValue([] as never);

      await repo.track({
        eventName: 'register',
        workspaceId: WORKSPACE_ID,
        userId: 'user-1',
      });

      expect(AnalyticsEventModel.create).toHaveBeenCalledTimes(1);
      const arg = vi.mocked(AnalyticsEventModel.create).mock.calls[0][0];
      expect(arg).toMatchObject({
        eventName: 'register',
        workspaceId: new Types.ObjectId(WORKSPACE_ID),
        userId: 'user-1',
      });
      expect(arg.occurredAt).toBeInstanceOf(Date);
    });

    it('never throws when create fails (best-effort)', async () => {
      vi.mocked(AnalyticsEventModel.create).mockRejectedValue(new Error('db down'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        repo.track({ eventName: 'saleCreated', workspaceId: WORKSPACE_ID, userId: 'u1' }),
      ).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });

  describe('track (first events — deduplicated)', () => {
    it('uses findOneAndUpdate upsert for firstLogin', async () => {
      vi.mocked(AnalyticsEventModel.findOneAndUpdate).mockReturnValue(execChain() as never);

      await repo.track({
        eventName: 'firstLogin',
        workspaceId: WORKSPACE_ID,
        userId: 'user-1',
      });

      expect(AnalyticsEventModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(AnalyticsEventModel.create).not.toHaveBeenCalled();

      const [filter, update] = vi.mocked(AnalyticsEventModel.findOneAndUpdate).mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(filter).toEqual({
        workspaceId: new Types.ObjectId(WORKSPACE_ID),
        eventName: 'firstLogin',
      });
      expect(update).toHaveProperty('$setOnInsert');
    });

    it('uses findOneAndUpdate upsert for firstMovement', async () => {
      vi.mocked(AnalyticsEventModel.findOneAndUpdate).mockReturnValue(execChain() as never);

      await repo.track({
        eventName: 'firstMovement',
        workspaceId: WORKSPACE_ID,
        userId: 'user-2',
      });

      expect(AnalyticsEventModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
      const [filter] = vi.mocked(AnalyticsEventModel.findOneAndUpdate).mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(filter.eventName).toBe('firstMovement');
    });

    it('never throws when the upsert fails (best-effort)', async () => {
      vi.mocked(AnalyticsEventModel.findOneAndUpdate).mockReturnValue({
        exec: vi.fn().mockRejectedValue(new Error('db down')),
      } as never);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        repo.track({ eventName: 'firstLogin', workspaceId: WORKSPACE_ID, userId: 'u1' }),
      ).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });

  describe('no active connection', () => {
    it('skips the write and does not hang or throw', async () => {
      vi.mocked(isDbConnected).mockReturnValue(false);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        repo.track({ eventName: 'dashboardViewed', workspaceId: WORKSPACE_ID, userId: 'u1' }),
      ).resolves.toBeUndefined();

      expect(AnalyticsEventModel.create).not.toHaveBeenCalled();
      expect(AnalyticsEventModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });
  });
});