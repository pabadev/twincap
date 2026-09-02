import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OperationLogRecord } from '../../core/application/ports';

// Mock the OperationLogModel so no DB connection is required.
vi.mock('../models/operation-log', () => ({
  OperationLogModel: { create: vi.fn() },
}));
// A real connection is simulated so the logger attempts the write.
vi.mock('../db/connection', () => ({
  isDbConnected: vi.fn().mockReturnValue(true),
}));

import { MongoOperationLogger } from './operation-log-repository';
import { OperationLogModel } from '../models/operation-log';
import type { OperationLogDocument } from '../models/operation-log';
import { isDbConnected } from '../db/connection';

function baseRecord(overrides: Partial<OperationLogRecord> = {}): OperationLogRecord {
  return {
    userId: 'user-123',
    action: 'createMovement',
    entityType: 'movement',
    result: 'success',
    occurredAt: new Date('2026-08-31T10:00:00.000Z'),
    ...overrides,
  };
}

describe('MongoOperationLogger', () => {
  let logger: MongoOperationLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the default "connected" state; individual tests may override.
    vi.mocked(isDbConnected).mockReturnValue(true);
    logger = new MongoOperationLogger();
  });

  describe('log (success)', () => {
    it('persists the document via OperationLogModel.create', async () => {
      const record = baseRecord({ durationMs: 12, correlationId: 'key-1', entityId: 'mov-1' });
      vi.mocked(OperationLogModel.create).mockResolvedValue([] as OperationLogDocument[]);

      await logger.log(record);

      expect(OperationLogModel.create).toHaveBeenCalledTimes(1);
      expect(OperationLogModel.create).toHaveBeenCalledWith(record);
    });
  });

  describe('log (best-effort on failure)', () => {
    it('does NOT re-throw when OperationLogModel.create fails', async () => {
      vi.mocked(OperationLogModel.create).mockRejectedValue(new Error('db down'));

      // Must not throw — the financial operation must flow.
      await expect(logger.log(baseRecord())).resolves.toBeUndefined();
    });

    it('emits a structured JSON error to stderr and does not break', async () => {
      const err = new Error('connection lost');
      vi.mocked(OperationLogModel.create).mockRejectedValue(err);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await logger.log(baseRecord({ action: 'deleteSale', entityType: 'sale', userId: 'u1' }));

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(errorSpy.mock.calls[0][0] as string);
      expect(payload).toMatchObject({
        level: 'error',
        event: 'audit_log_write_failed',
        action: 'deleteSale',
        entityType: 'sale',
        userId: 'u1',
        error: 'connection lost',
      });

      errorSpy.mockRestore();
    });

    it('does not expose PII in the emitted error object', async () => {
      const err = new Error('boom');
      vi.mocked(OperationLogModel.create).mockRejectedValue(err);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await logger.log(baseRecord());

      const payload = JSON.parse(errorSpy.mock.calls[0][0] as string);
      expect(payload).not.toHaveProperty('email');
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('payload');
      expect(payload).not.toHaveProperty('stack');

      errorSpy.mockRestore();
    });
  });

  describe('no active connection', () => {
    it('skips the write and does not hang or throw', async () => {
      vi.mocked(isDbConnected).mockReturnValue(false);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(logger.log(baseRecord())).resolves.toBeUndefined();

      expect(OperationLogModel.create).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });
  });

  describe('minimum record (no PII)', () => {
    it('accepts a record with only the required fields', async () => {
      const record: OperationLogRecord = {
        userId: 'u-1',
        action: 'login',
        entityType: 'auth',
        result: 'success',
        occurredAt: new Date(),
      };
      vi.mocked(OperationLogModel.create).mockResolvedValue([] as OperationLogDocument[]);

      await logger.log(record);

      expect(OperationLogModel.create).toHaveBeenCalledWith(record);
      const keys = Object.keys(record);
      expect(keys).toEqual(['userId', 'action', 'entityType', 'result', 'occurredAt']);
    });
  });
});
