import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FeedbackRecord } from '../../core/application/ports';

// Mock the FeedbackModel so no DB connection is required.
vi.mock('../models/feedback', () => ({
  FeedbackModel: { create: vi.fn() },
}));
// A real connection is simulated so the repository attempts the write.
vi.mock('../db/connection', () => ({
  isDbConnected: vi.fn().mockReturnValue(true),
}));

import { MongoFeedbackRepository } from './feedback-repository';
import { FeedbackModel } from '../models/feedback';
import type { FeedbackDocument } from '../models/feedback';
import { isDbConnected } from '../db/connection';

function baseRecord(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    kind: 'bug',
    message: 'Dashboard crashes on load',
    userId: 'user-123',
    locale: 'es',
    result: 'delivered',
    attemptedAt: new Date('2026-09-07T10:00:00.000Z'),
    ...overrides,
  };
}

describe('MongoFeedbackRepository', () => {
  let repository: MongoFeedbackRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the default "connected" state; individual tests may override.
    vi.mocked(isDbConnected).mockReturnValue(true);
    repository = new MongoFeedbackRepository();
  });

  describe('record (success)', () => {
    it('persists the document via FeedbackModel.create', async () => {
      const record = baseRecord({ email: 'author@example.com', page: '/dashboard' });
      vi.mocked(FeedbackModel.create).mockResolvedValue([] as FeedbackDocument[]);

      await repository.record(record);

      expect(FeedbackModel.create).toHaveBeenCalledTimes(1);
      expect(FeedbackModel.create).toHaveBeenCalledWith(record);
    });
  });

  describe('record (best-effort on failure)', () => {
    it('does NOT re-throw when FeedbackModel.create fails', async () => {
      vi.mocked(FeedbackModel.create).mockRejectedValue(new Error('db down'));

      // Must not throw — the submit flow must flow.
      await expect(repository.record(baseRecord())).resolves.toBeUndefined();
    });

    it('emits a structured JSON error to stderr and does not break', async () => {
      const err = new Error('connection lost');
      vi.mocked(FeedbackModel.create).mockRejectedValue(err);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await repository.record(baseRecord({ kind: 'suggestion', userId: 'u1' }));

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(errorSpy.mock.calls[0][0] as string);
      expect(payload).toMatchObject({
        level: 'error',
        event: 'feedback_write_failed',
        kind: 'suggestion',
        userId: 'u1',
        error: 'connection lost',
      });

      errorSpy.mockRestore();
    });
  });

  describe('no active connection', () => {
    it('skips the write and does not hang or throw', async () => {
      vi.mocked(isDbConnected).mockReturnValue(false);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(repository.record(baseRecord())).resolves.toBeUndefined();

      expect(FeedbackModel.create).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });
  });
});