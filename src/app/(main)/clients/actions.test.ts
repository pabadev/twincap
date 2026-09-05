import { describe, it, expect, vi, beforeEach } from 'vitest';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repository, and next/cache.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoClientRepository } = vi.hoisted(() => ({
  MongoClientRepository: vi.fn(),
}));

vi.mock('../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../infrastructure/repositories/client-repository', () => ({
  MongoClientRepository,
}));

const { createClientAction, updateClientAction } = await import('./actions');

function clientFormData(name = 'Ana Gómez'): FormData {
  const fd = new FormData();
  fd.append('name', name);
  fd.append('phone', '');
  fd.append('email', '');
  fd.append('note', '');
  return fd;
}

/** Plain client-shaped object with a toJSON snapshot (what the repo returns). */
function clientEntity(overrides: Record<string, string> = {}) {
  const entity: Record<string, unknown> = {
    id: 'cl-1',
    workspaceId: 'user-1',
    name: 'Ana Gómez',
    phone: '',
    email: '',
    note: '',
    createdAt: new Date('2026-08-01'),
    ...overrides,
    toJSON() {
      return {
        id: entity.id,
        workspaceId: entity.workspaceId,
        name: entity.name,
        phone: entity.phone,
        email: entity.email,
        note: entity.note,
        createdAt: entity.createdAt,
      };
    },
  };
  return entity;
}

describe('createClientAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    MongoClientRepository.mockImplementation(() => ({
      findByName: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (client: unknown) => client),
    }));
  });

  it('returns the created client snapshot so the sale form can auto-select it', async () => {
    const result = await createClientAction(null, clientFormData('Ana Gómez'));

    expect(result.success).toBe('clientCreated');
    expect(result.client).toBeTruthy();
    expect(result.client?.name).toBe('Ana Gómez');
    expect(result.client?.id).toBeTruthy();
    expect(revalidatePath).toHaveBeenCalledWith('/clients');
    expect(revalidatePath).toHaveBeenCalledWith('/pos/sales');
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await createClientAction(null, clientFormData());

    expect(result).toEqual({ error: 'error.unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoClientRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('updateClientAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    MongoClientRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(clientEntity()),
      update: vi.fn().mockImplementation(async (client: unknown) => client),
    }));
  });

  it('returns the updated serialized client snapshot', async () => {
    const fd = clientFormData('Carlos Ruiz');
    fd.append('clientId', 'cl-1');

    const result = await updateClientAction(null, fd);

    expect(result.success).toBe('clientUpdated');
    expect(result.client).toBeTruthy();
    expect(result.client?.id).toBe('cl-1');
    expect(result.client?.name).toBe('Carlos Ruiz');
    expect(revalidatePath).toHaveBeenCalledWith('/clients');
    expect(revalidatePath).toHaveBeenCalledWith('/pos/sales');
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await updateClientAction(null, clientFormData());

    expect(result).toEqual({ error: 'error.unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoClientRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});