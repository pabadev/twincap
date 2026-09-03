import { describe, it, expect, vi, beforeEach } from 'vitest';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repository, and next/cache.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoAccountRepository } = vi.hoisted(() => ({
  MongoAccountRepository: vi.fn(),
}));
const { MongoMovementRepository } = vi.hoisted(() => ({
  MongoMovementRepository: vi.fn(),
}));

vi.mock('../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../infrastructure/repositories/account-repository', () => ({
  MongoAccountRepository,
}));
vi.mock('../../../infrastructure/repositories/movement-repository', () => ({
  MongoMovementRepository,
}));

const { updateAccountAction, deleteAccountAction, setInitialBalanceAction } =
  await import('./actions');

function formData(accountId = 'acc-1', amount?: number): FormData {
  const fd = new FormData();
  fd.append('accountId', accountId);
  if (amount !== undefined) fd.append('amount', String(amount));
  return fd;
}

describe('updateAccountAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue({
        id: 'acc-1',
        workspaceId: 'user-1',
        name: 'Efectivo',
        currency: 'COP',
        isFixed: true,
        createdAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue(undefined),
    }));
  });

  function renameFormData(name = 'Caja diaria'): FormData {
    const fd = new FormData();
    fd.append('accountId', 'acc-1');
    fd.append('name', name);
    return fd;
  }

  it('renames the account and returns the success toast key', async () => {
    const result = await updateAccountAction(null, renameFormData());

    expect(result).toEqual({ success: 'accountUpdated' });
    expect(revalidatePath).toHaveBeenCalledWith('/accounts');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/movements');
    expect(revalidatePath).toHaveBeenCalledWith('/transfers');
  });

  it('maps a missing account to the notFound error key', async () => {
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
    }));

    const result = await updateAccountAction(null, renameFormData());

    expect(result).toEqual({ error: 'error.notFound' });
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await updateAccountAction(null, renameFormData());

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoAccountRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deleteAccountAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      countReferences: vi.fn().mockResolvedValue(0),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      findByAccountId: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await deleteAccountAction(null, formData());

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoAccountRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('setInitialBalanceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue({
        id: 'acc-1',
        workspaceId: 'user-1',
        name: 'Efectivo',
        currency: 'COP',
        isFixed: true,
        createdAt: new Date(),
      }),
      countReferences: vi.fn().mockResolvedValue(0),
    }));
  });

  it('sets the initial balance and returns the success toast key', async () => {
    const created: unknown[] = [];
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockImplementation(async (movement: unknown) => {
        created.push(movement);
        return movement;
      }),
    }));

    const result = await setInitialBalanceAction(null, formData('acc-1', 50000));

    expect(result).toEqual({ success: 'initialBalanceSet' });
    expect(created).toHaveLength(1);
    const movement = created[0] as {
      type: string;
      link: { kind: string; refId: string };
    };
    expect(movement.type).toBe('income');
    expect(movement.link.kind).toBe('opening');
    expect(movement.link.refId).toBe('acc-1');
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await setInitialBalanceAction(null, formData('acc-1', 50000));

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoAccountRepository).not.toHaveBeenCalled();
  });
});
