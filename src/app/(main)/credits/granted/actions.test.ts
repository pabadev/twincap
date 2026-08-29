import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreditGranted } from '../../../../core/domain/credit-granted';
import { Money } from '../../../../core/domain/money';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repository, and next/cache
// (the action's revalidateMovementData shells out to revalidatePath).

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoCreditGrantedRepository } = vi.hoisted(() => ({
  MongoCreditGrantedRepository: vi.fn(),
}));
const { MongoMovementRepository } = vi.hoisted(() => ({
  MongoMovementRepository: vi.fn(),
}));

vi.mock('../../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../../infrastructure/repositories/credit-granted-repository', () => ({
  MongoCreditGrantedRepository,
}));
vi.mock('../../../../infrastructure/repositories/movement-repository', () => ({
  MongoMovementRepository,
}));

const { writeOffCreditAction } = await import('./actions');

function makeCreditGranted(): CreditGranted {
  return new CreditGranted({
    id: 'cg-1',
    userId: 'user-1',
    counterparty: 'Pedro',
    principal: new Money(100000, 'COP'),
    accountId: 'acc-1',
    date: new Date('2025-06-01'),
    createdAt: new Date(),
  });
}

function formData(creditId = 'cg-1'): FormData {
  const fd = new FormData();
  fd.append('creditId', creditId);
  return fd;
}

describe('writeOffCreditAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    MongoCreditGrantedRepository.mockImplementation(() => ({
      findByUserId: vi.fn().mockResolvedValue([makeCreditGranted()]),
      markWrittenOff: vi.fn().mockResolvedValue(undefined),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockImplementation(async (movement: unknown) => movement),
    }));
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await writeOffCreditAction(null, formData());

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoCreditGrantedRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('writes off the credit, registers the expense movement and revalidates', async () => {
    const markWrittenOff = vi.fn().mockResolvedValue(undefined);
    const created: unknown[] = [];
    MongoCreditGrantedRepository.mockImplementation(() => ({
      findByUserId: vi.fn().mockResolvedValue([makeCreditGranted()]),
      markWrittenOff,
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockImplementation(async (movement: unknown) => {
        created.push(movement);
        return movement;
      }),
      update: vi.fn().mockImplementation(async (movement: unknown) => movement),
      delete: vi.fn().mockResolvedValue(undefined),
    }));

    const result = await writeOffCreditAction(null, formData());

    expect(result).toEqual({ success: 'creditWrittenOff' });
    expect(created).toHaveLength(1);
    const movement = created[0] as {
      type: string;
      amount: { amount: number; currency: string };
      link: { kind: string; refId: string };
    };
    expect(movement.type).toBe('expense');
    expect(movement.amount.amount).toBe(100000);
    expect(movement.link.kind).toBe('creditGrantedWriteOff');
    expect(movement.link.refId).toBe('cg-1');
    expect(markWrittenOff).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledTimes(4);
  });

  it('maps a NotFoundError to the i18n notFound toast key', async () => {
    MongoCreditGrantedRepository.mockImplementation(() => ({
      findByUserId: vi.fn().mockResolvedValue([]),
      markWrittenOff: vi.fn().mockResolvedValue(undefined),
    }));

    const result = await writeOffCreditAction(null, formData());

    expect(result).toEqual({ error: 'error.notFound' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});