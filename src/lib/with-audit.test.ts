import { describe, it, expect, vi } from 'vitest';
import type { OperationLogger, OperationLogRecord } from '../core/application/ports';
import { withAudit } from './with-audit';

/** Captures the records passed to log(). */
function makeLogger(impl?: (r: OperationLogRecord) => Promise<void>): {
  logger: OperationLogger;
  records: OperationLogRecord[];
} {
  const records: OperationLogRecord[] = [];
  const logger: OperationLogger = {
    log: vi.fn(async (r: OperationLogRecord) => {
      records.push(r);
      if (impl) await impl(r);
    }),
  };
  return { logger, records };
}

const opts = { action: 'createMovement', entityType: 'movement', userId: 'u-1' };

describe('withAudit', () => {
  it('on success logs result "success" with a numeric durationMs', async () => {
    const { logger, records } = makeLogger();

    await withAudit(logger, opts, async () => {});

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      userId: 'u-1',
      action: 'createMovement',
      entityType: 'movement',
      result: 'success',
    });
    expect(typeof records[0].durationMs).toBe('number');
    expect(records[0].durationMs!).toBeGreaterThanOrEqual(0);
    expect(records[0].occurredAt).toBeInstanceOf(Date);
  });

  it('propagates the return value of fn unchanged', async () => {
    const { logger } = makeLogger();
    const out = await withAudit(logger, opts, async () => ({ hello: 'world' as string }));
    expect(out).toEqual({ hello: 'world' });
  });

  it('accepts result "duplicate" from fn and stores it', async () => {
    const { logger, records } = makeLogger();
    await withAudit(logger, opts, async () => ({ result: 'duplicate' as const }));
    expect(records[0].result).toBe('duplicate');
  });

  it('propagates entityId returned by fn into the log', async () => {
    const { logger, records } = makeLogger();
    await withAudit(logger, opts, async () => ({ entityId: 'mov-42' }));
    expect(records[0].entityId).toBe('mov-42');
  });

  it('on error logs result "error" with errorCode, then re-throws', async () => {
    const { logger, records } = makeLogger();
    const boom = new Error('Account has references and cannot be deleted');

    await expect(withAudit(logger, opts, async () => { throw boom; })).rejects.toBe(boom);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      userId: 'u-1',
      action: 'createMovement',
      entityType: 'movement',
      result: 'error',
      errorCode: 'Account has references and cannot be deleted',
    });
    expect(typeof records[0].durationMs).toBe('number');
  });

  it('logs BEFORE re-throwing (log is not skipped on failure)', async () => {
    const { logger, records } = makeLogger();
    try {
      await withAudit(logger, opts, async () => {
        throw new Error('x');
      });
    } catch {
      /* expected */
    }
    expect(records).toHaveLength(1);
    expect(records[0].result).toBe('error');
  });

  it('does not break fn when the logger itself fails', async () => {
    const failingLogger: OperationLogger = {
      log: async () => { throw new Error('audit write failed'); },
    };

    const out = await withAudit(failingLogger, opts, async () => ({ ok: true }));
    expect(out).toEqual({ ok: true });
  });

  it('uses correlationId when provided', async () => {
    const { logger, records } = makeLogger();
    await withAudit(
      logger,
      { ...opts, correlationId: 'idem-1' },
      async () => {},
    );
    expect(records[0].correlationId).toBe('idem-1');
  });
});
