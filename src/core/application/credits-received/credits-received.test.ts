import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreditReceived } from './create-credit-received';
import { addAbono } from './add-abono';
import { editAbono } from './edit-abono';
import { deleteAbono } from './delete-abono';
import { editPrincipal } from './edit-principal';
import { deleteCreditReceived } from './delete-credit-received';
import { CreditReceived } from '../../domain/credit-received';
import { Movement } from '../../domain/movement';
import { Category } from '../../domain/category';
import { Account } from '../../domain/account';
import { Money } from '../../domain/money';
import type { Currency } from '../../domain/currency';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors';
import type { CreditReceivedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { TransactionHandle } from '../../domain/transaction';
import type { IdGenerator, UnitOfWork } from '../ports';
import type { CreditAbono } from '../../domain/credit-received';

// ─── Fake factories ────────────────────────────────────────────────

let idCounter = 0;

interface AbonoRecord {
  id: string;
  amount: number;
  date: Date;
  accountId: string;
  movementId?: string;
}

function fakeAccountRepo(
  accounts: Account[] = [],
): AccountRepository {
  return {
    findById: vi.fn().mockImplementation(async (_userId: string, id: string) =>
      accounts.find((a) => a.id === id) ?? null,
    ),
    findByWorkspaceId: vi.fn().mockResolvedValue(accounts),
    create: vi.fn().mockImplementation(async (account: Account) => account),
    update: vi.fn().mockImplementation(async (account: Account) => account),
    delete: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn().mockResolvedValue(true),
    countReferences: vi.fn().mockResolvedValue(0),
    bumpVersion: vi.fn().mockResolvedValue(true),
  };
}

function makeAccount(
  id: string,
  currency: Currency = 'COP',
): Account {
  return new Account({
    id,
    workspaceId: 'user-1',
    name: `Account ${id}`,
    currency,
    isFixed: false,
    createdAt: new Date(),
  });
}

function fakeCreditRepo(
  overrides: Partial<CreditReceivedRepository> = {},
): CreditReceivedRepository & { created: CreditReceived[]; updated: CreditReceived[]; deleted: string[]; abonosAdded: { creditId: string; abono: AbonoRecord }[]; abonosEdited: { creditId: string; abonoId: string; updates: Partial<{ amount: number; date: Date; movementId: string }> }[]; abonosDeleted: { creditId: string; abonoId: string }[] } {
  const created: CreditReceived[] = [];
  const updated: CreditReceived[] = [];
  const deleted: string[] = [];
  const abonosAdded: { creditId: string; abono: AbonoRecord }[] = [];
  const abonosEdited: { creditId: string; abonoId: string; updates: Partial<{ amount: number; date: Date; movementId: string }> }[] = [];
  const abonosDeleted: { creditId: string; abonoId: string }[] = [];
  return {
    created,
    updated,
    deleted,
    abonosAdded,
    abonosEdited,
    abonosDeleted,
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (credit: CreditReceived) => {
      created.push(credit);
      return credit;
    }),
    update: vi.fn().mockImplementation(async (credit: CreditReceived) => {
      updated.push(credit);
      return credit;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    addAbono: vi.fn().mockImplementation(async (_userId: string, creditId: string, abono: AbonoRecord) => {
      abonosAdded.push({ creditId, abono });
    }),
    editAbono: vi.fn().mockImplementation(async (_userId: string, creditId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>) => {
      abonosEdited.push({ creditId, abonoId, updates });
    }),
    deleteAbono: vi.fn().mockImplementation(async (_userId: string, creditId: string, abonoId: string) => {
      abonosDeleted.push({ creditId, abonoId });
    }),
    ...overrides,
  };
}

function fakeMovementRepo(
  overrides: Partial<MovementRepository> = {},
): MovementRepository & { created: Movement[]; updated: Movement[]; deleted: string[] } {
  const created: Movement[] = [];
  const updated: Movement[] = [];
  const deleted: string[] = [];
  return {
    created,
    updated,
    deleted,
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    findByAccountId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (movement: Movement) => {
      created.push(movement);
      return movement;
    }),
    update: vi.fn().mockImplementation(async (movement: Movement) => {
      updated.push(movement);
      return movement;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    deleteByRefId: vi.fn().mockResolvedValue(0),
    aggregateBalance: vi.fn().mockResolvedValue(0),
    countByCategoryId: vi.fn().mockResolvedValue(0),
    findPaged: async () => ({ items: [], nextCursor: null }),
    findByWorkspaceIdAndDateRange: async () => [],
    findByWorkspaceIdForBalance: async () => [],
    ...overrides,
  };
}

function fakeIdGen(): IdGenerator {
  return { generate: () => `id-${++idCounter}` };
}

/** R15 Fase 2: transparent unit of work that just runs the callback (no real tx). */
function fakeUow(): UnitOfWork {
  return {
    withTransaction: <T>(fn: (tx: TransactionHandle) => Promise<T>) =>
      fn({} as TransactionHandle),
  };
}

function makeCredit(
  overrides: Partial<ConstructorParameters<typeof CreditReceived>[0]> = {},
  abonos: CreditAbono[] = [],
): CreditReceived {
  return new CreditReceived(
    {
      id: 'cr-1',
      workspaceId: 'user-1',
      counterparty: 'Juan',
      principal: new Money(100000, 'COP'),
      accountId: 'acc-1',
      date: new Date('2025-06-01'),
      createdAt: new Date(),
      ...overrides,
    },
    abonos,
  );
}

function makeMovement(
  overrides: Partial<ConstructorParameters<typeof Movement>[0]> = {},
): Movement {
  const type = overrides.type ?? 'expense';
  return new Movement({
    id: 'mov-1',
    workspaceId: 'user-1',
    accountId: 'acc-1',
    category: new Category({ id: 'cat-1', workspaceId: 'user-1', name: 'Credit', type, createdAt: new Date() }),
    type,
    amount: new Money(50000, 'COP'),
    date: new Date('2025-06-01'),
    context: 'Personal',
    createdAt: new Date(),
    ...overrides,
  });
}

beforeEach(() => {
  idCounter = 0;
});

// ─── Create ────────────────────────────────────────────────────────

describe('createCreditReceived', () => {
  it('creates a credit and principal income movement (CRED-R-1)', async () => {
    const creditRepo = fakeCreditRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const credit = await createCreditReceived(
      'user-1',
      {
        counterparty: 'Juan',
        principal: 100000,
        currency: 'COP',
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
      },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );

    expect(credit.counterparty).toBe('Juan');
    expect(credit.principal.amount).toBe(100000);
    expect(credit.principal.currency).toBe('COP');
    expect(creditRepo.created).toHaveLength(1);
    expect(movementRepo.created).toHaveLength(1);

    const movement = movementRepo.created[0];
    expect(movement.type).toBe('income');
    expect(movement.amount.amount).toBe(100000);
    expect(movement.signedAmount).toBe(100000);
    expect(movement.accountId).toBe('acc-1');
    expect(movement.link?.kind).toBe('creditReceivedPrincipal');
    expect(movement.link?.refId).toBe(credit.id);
  });

  it('sets context to Personal (hardcoded) for credit received principal movement', async () => {
    const creditRepo = fakeCreditRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await createCreditReceived(
      'user-1',
      {
        counterparty: 'Juan',
        principal: 100000,
        currency: 'COP',
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
      },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );

    expect(movementRepo.created[0].context).toBe('Personal');
  });

  it('throws NotFoundError when the account does not exist (D3 tenant guard)', async () => {
    const creditRepo = fakeCreditRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([]);
    const ids = fakeIdGen();

    await expect(
      createCreditReceived(
        'user-1',
        {
          counterparty: 'Juan',
          principal: 100000,
          currency: 'COP',
          accountId: 'acc-missing',
          date: new Date('2025-06-01'),
        },
        creditRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('creates credit with optional installments and frequency', async () => {
    const creditRepo = fakeCreditRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const credit = await createCreditReceived(
      'user-1',
      {
        counterparty: 'Maria',
        principal: 50000,
        currency: 'COP',
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
        installments: 12,
        installmentValue: 10000,
        frequency: 'monthly',
      },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );

    expect(credit.installments).toBe(12);
    expect(credit.installmentValue?.amount).toBe(10000);
    expect(credit.totalToPay).toBe(120000);
    expect(credit.frequency).toBe('monthly');
  });

  it('throws ValidationError when the credit currency does not match the account currency (ACC-1)', async () => {
    const creditRepo = fakeCreditRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1', 'USD')]);
    const ids = fakeIdGen();

    await expect(
      createCreditReceived(
        'user-1',
        {
          counterparty: 'Juan',
          principal: 100000,
          currency: 'COP',
          accountId: 'acc-1',
          date: new Date('2025-06-01'),
        },
        creditRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);

    expect(creditRepo.created).toHaveLength(0);
    expect(movementRepo.created).toHaveLength(0);
  });
});

// ─── Add Abono ─────────────────────────────────────────────────────

describe('addAbono', () => {
  it('adds an abono and creates expense movement', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const result = await addAbono(
      'user-1',
      'cr-1',
      { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
      creditRepo,
      movementRepo,
      ids,
      accountRepo, fakeUow());

    expect(result.abonos).toHaveLength(1);
    expect(result.abonos[0].amount.amount).toBe(25000);
    expect(result.pending).toBe(75000);
    expect(creditRepo.addAbono).toHaveBeenCalledOnce();
    expect(movementRepo.created).toHaveLength(1);

    const movement = movementRepo.created[0];
    expect(movement.type).toBe('expense');
    expect(movement.amount.amount).toBe(25000);
    expect(movement.signedAmount).toBe(-25000);
    expect(movement.link?.kind).toBe('creditReceivedAbono');
  });

  it('sets context to Personal (hardcoded) for credit received abono movement', async () => {
    const credit = makeCredit(); // credit.accountId = acc-1
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await addAbono(
      'user-1',
      'cr-1',
      { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
      creditRepo,
      movementRepo,
      ids,
      accountRepo, fakeUow());

    const movement = movementRepo.created[0];
    expect(movement.accountId).toBe('acc-1');
    expect(movement.context).toBe('Personal');
  });

  it('throws ValidationError when the payment account currency differs from the abono currency (ACC-1)', async () => {
    const credit = makeCredit(); // credit.principal is COP
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    // Payment account is USD but the abono is COP — the movement would be
    // re-labeled to USD on read, silently corrupting the ledger.
    const accountRepo = fakeAccountRepo([makeAccount('acc-1', 'USD')]);
    const ids = fakeIdGen();

    await expect(
      addAbono(
        'user-1',
        'cr-1',
        { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
        creditRepo,
        movementRepo,
        ids,
        accountRepo, fakeUow()),
    ).rejects.toThrow(ValidationError);

    expect(creditRepo.addAbono).not.toHaveBeenCalled();
    expect(movementRepo.created).toHaveLength(0);
  });

  it('throws ConflictError on overpayment (CRED-R-2)', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      addAbono(
        'user-1',
        'cr-1',
        { amount: 150000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
        creditRepo,
        movementRepo,
        ids,
        accountRepo, fakeUow()),
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      addAbono(
        'user-1',
        'missing',
        { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date() },
        creditRepo,
        movementRepo,
        ids,
        accountRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the payment account does not exist (D3)', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([]);
    const ids = fakeIdGen();

    await expect(
      addAbono(
        'user-1',
        'cr-1',
        { amount: 25000, currency: 'COP', accountId: 'acc-missing', date: new Date() },
        creditRepo,
        movementRepo,
        ids,
        accountRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when the abono currency differs from the credit currency (ACC-1)', async () => {
    const credit = makeCredit({ principal: new Money(100000, 'USD') });
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1', 'USD')]);
    const ids = fakeIdGen();

    await expect(
      addAbono(
        'user-1',
        'cr-1',
        { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
        creditRepo,
        movementRepo,
        ids,
        accountRepo, fakeUow()),
    ).rejects.toThrow(ValidationError);
    expect(movementRepo.created).toHaveLength(0);
  });
});

// ─── Edit Abono ────────────────────────────────────────────────────

describe('editAbono', () => {
  it('edits abono amount and updates linked movement', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const existingMovement = makeMovement({ id: 'mov-1', amount: new Money(25000, 'COP') });

    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existingMovement),
    });

    const result = await editAbono(
      'user-1',
      'cr-1',
      'ab-1',
      { amount: 30000 },
      creditRepo,
      movementRepo, fakeUow());

    expect(result.abonos[0].amount.amount).toBe(30000);
    expect(result.pending).toBe(70000);
    expect(creditRepo.editAbono).toHaveBeenCalledOnce();
    expect(movementRepo.updated).toHaveLength(1);
    expect(movementRepo.updated[0].amount.amount).toBe(30000);
    expect(movementRepo.updated[0].signedAmount).toBe(-30000);
  });

  it('keeps saldo == sum(movements): embedded abono and movement move together', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const existingMovement = makeMovement({ id: 'mov-1', amount: new Money(25000, 'COP') });

    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existingMovement),
    });

    const result = await editAbono(
      'user-1',
      'cr-1',
      'ab-1',
      { amount: 40000 },
      creditRepo,
      movementRepo, fakeUow());

    // Embedded abono and linked movement must end with the SAME amount
    expect(creditRepo.abonosEdited[0].updates.amount).toBe(40000);
    expect(movementRepo.updated[0].amount.amount).toBe(40000);
    expect(result.pending).toBe(60000);
  });

  it('skips movement update when abono has no movementId', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await editAbono(
      'user-1',
      'cr-1',
      'ab-1',
      { amount: 30000 },
      creditRepo,
      movementRepo, fakeUow());

    expect(result.abonos[0].amount.amount).toBe(30000);
    expect(creditRepo.editAbono).toHaveBeenCalledOnce();
    expect(movementRepo.findById).not.toHaveBeenCalled();
    expect(movementRepo.updated).toHaveLength(0);
  });

  it('throws ConflictError when new amount exceeds pending', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      editAbono('user-1', 'cr-1', 'ab-1', { amount: 200000 }, creditRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects a MODERN credit whose required movement is missing (R15.1 6c)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-missing' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    // findById resolves null → required movement missing
    const movementRepo = fakeMovementRepo();

    const error = await editAbono(
      'user-1',
      'cr-1',
      'ab-1',
      { amount: 30000 },
      creditRepo,
      movementRepo,
      fakeUow(),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe('Required movement not found for modern record');
    // Fail-fast: the abono write must NOT be performed (tx rolls back)
    expect(creditRepo.abonosEdited).toHaveLength(0);
    expect(movementRepo.updated).toHaveLength(0);
  });

  it('keeps the tolerant behavior for a LEGACY credit with a missing movement (R15.1 6c)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const credit = makeCredit({ createdAt: new Date('2026-08-01T00:00:00.000Z') }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-missing' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await editAbono(
      'user-1',
      'cr-1',
      'ab-1',
      { amount: 30000 },
      creditRepo,
      movementRepo,
      fakeUow());

    expect(result.abonos[0].amount.amount).toBe(30000);
    expect(creditRepo.editAbono).toHaveBeenCalledOnce();
    expect(movementRepo.updated).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[reconcile] Legacy record missing movement, continuing',
      expect.objectContaining({ aggregateId: 'cr-1', movementId: 'mov-missing' }),
    );
    warnSpy.mockRestore();
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      editAbono('user-1', 'missing', 'ab-1', { amount: 30000 }, creditRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when abono does not exist', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      editAbono('user-1', 'cr-1', 'missing-abono', { amount: 30000 }, creditRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Delete Abono ──────────────────────────────────────────────────

describe('deleteAbono', () => {
  it('removes abono and reverses linked movement', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await deleteAbono('user-1', 'cr-1', 'ab-1', creditRepo, movementRepo, fakeUow());

    expect(result.abonos).toHaveLength(0);
    expect(result.pending).toBe(100000);
    expect(creditRepo.deleteAbono).toHaveBeenCalledOnce();
    expect(movementRepo.deleted).toContain('mov-1');
  });

  it('skips movement deletion when abono has no movementId', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await deleteAbono('user-1', 'cr-1', 'ab-1', creditRepo, movementRepo, fakeUow());

    expect(result.abonos).toHaveLength(0);
    expect(result.pending).toBe(100000);
    expect(movementRepo.delete).not.toHaveBeenCalled();
  });

  it('deletes the linked movement BEFORE pulling the abono (R5-B atomicity)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const deleteAbonoMock = vi.fn().mockImplementation(async () => {});
    const deleteMovementMock = vi.fn().mockImplementation(async () => {});
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
      deleteAbono: deleteAbonoMock,
    });
    const movementRepo = fakeMovementRepo({ delete: deleteMovementMock });

    await deleteAbono('user-1', 'cr-1', 'ab-1', creditRepo, movementRepo, fakeUow());

    expect(deleteMovementMock.mock.invocationCallOrder[0])
      .toBeLessThan(deleteAbonoMock.mock.invocationCallOrder[0]);
  });

  it('tolerates an already-missing movement when deleting an abono (R5-B)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      delete: vi.fn().mockRejectedValue(new NotFoundError('Movement not found')),
    });

    const result = await deleteAbono('user-1', 'cr-1', 'ab-1', creditRepo, movementRepo, fakeUow());

    expect(result.abonos).toHaveLength(0);
    expect(creditRepo.deleteAbono).toHaveBeenCalledOnce();
    expect(movementRepo.deleted).toHaveLength(0);
  });

  it('propagates non-NotFound movement errors WITHOUT pulling the abono (R5-B)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      delete: vi.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(
      deleteAbono('user-1', 'cr-1', 'ab-1', creditRepo, movementRepo, fakeUow()),
    ).rejects.toThrow('db down');

    expect(creditRepo.deleteAbono).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteAbono('user-1', 'missing', 'ab-1', creditRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when abono does not exist', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteAbono('user-1', 'cr-1', 'missing-abono', creditRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Edit Principal ────────────────────────────────────────────────

describe('editPrincipal', () => {
  it('updates principal and cascades to principal movement', async () => {
    const credit = makeCredit();
    const principalMovement = makeMovement({
      id: 'mov-principal',
      type: 'income',
      amount: new Money(100000, 'COP'),
      link: { kind: 'creditReceivedPrincipal', refId: 'cr-1', opId: 'op-1' },
    });

    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([principalMovement]),
    });

    const result = await editPrincipal(
      'user-1',
      'cr-1',
      { principal: 200000, currency: 'COP' },
      creditRepo,
      movementRepo,
      fakeUow(),
    );

    expect(result.principal.amount).toBe(200000);
    expect(result.version).toBe(1);
    // F5: the credit write is CAS-guarded on the version read inside the tx.
    expect(creditRepo.update).toHaveBeenCalledOnce();
    expect(creditRepo.update).toHaveBeenCalledWith(expect.anything(), expect.anything(), 0);
    expect(movementRepo.updated).toHaveLength(1);
    expect(movementRepo.updated[0].amount.amount).toBe(200000);
  });

  it('still updates credit when principal movement does not exist (LEGACY tolerance, R15.1 6c)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const credit = makeCredit({ createdAt: new Date('2026-08-01T00:00:00.000Z') });
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });

    const result = await editPrincipal(
      'user-1',
      'cr-1',
      { principal: 200000, currency: 'COP' },
      creditRepo,
      movementRepo,
      fakeUow(),
    );

    expect(result.principal.amount).toBe(200000);
    expect(creditRepo.update).toHaveBeenCalledOnce();
    expect(movementRepo.updated).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[reconcile] Legacy record missing movement, continuing',
      expect.objectContaining({ aggregateId: 'cr-1', kind: 'creditReceivedPrincipal' }),
    );
    warnSpy.mockRestore();
  });

  it('rejects a MODERN credit whose principal movement is missing (R15.1 6c)', async () => {
    const credit = makeCredit(); // createdAt defaults to now → modern
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });

    const error = await editPrincipal(
      'user-1',
      'cr-1',
      { principal: 200000, currency: 'COP' },
      creditRepo,
      movementRepo,
      fakeUow(),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe('Required movement not found for modern record');
    // Fail-fast: the credit write must NOT be performed (tx rolls back)
    expect(creditRepo.updated).toHaveLength(0);
    expect(movementRepo.updated).toHaveLength(0);
  });

  it('throws ConflictError when new principal < total abonos (CRED-R-5)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(50000, 'COP'), date: new Date(), accountId: 'acc-1' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      editPrincipal('user-1', 'cr-1', { principal: 30000, currency: 'COP' }, creditRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      editPrincipal('user-1', 'missing', { principal: 200000, currency: 'COP' }, creditRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when changing the principal currency (ACC-1)', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      editPrincipal('user-1', 'cr-1', { principal: 200000, currency: 'USD' }, creditRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(ValidationError);
    expect(creditRepo.update).not.toHaveBeenCalled();
  });
});

// ─── Delete Credit ─────────────────────────────────────────────────

describe('deleteCreditReceived', () => {
  it('cascade-deletes all linked movements via deleteByRefId then the credit', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date(), accountId: 'acc-1', movementId: 'mov-abono' },
    ]);

    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    await deleteCreditReceived('user-1', 'cr-1', creditRepo, movementRepo, fakeUow());

    // deleteByRefId is a format-agnostic deleteMany (principal + abonos).
    expect(movementRepo.deleteByRefId).toHaveBeenCalledWith('user-1', 'cr-1', expect.anything());
    expect(creditRepo.deleted).toContain('cr-1');
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteCreditReceived('user-1', 'missing', creditRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
    expect(movementRepo.deleteByRefId).not.toHaveBeenCalled();
    expect(creditRepo.delete).not.toHaveBeenCalled();
  });

  it('is tolerant of an already-deleted linked movement (R5-B) and still deletes the credit', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date(), accountId: 'acc-1', movementId: 'mov-already-gone' },
    ]);

    const creditRepo = fakeCreditRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      // deleteByRefId is tolerant by construction: a deleteMany reports 0 for
      // already-missing movements, never a NotFoundError.
      deleteByRefId: vi.fn().mockResolvedValue(0),
    });

    await expect(
      deleteCreditReceived('user-1', 'cr-1', creditRepo, movementRepo, fakeUow()),
    ).resolves.toBeUndefined();
    expect(creditRepo.deleted).toContain('cr-1');
  });
});
