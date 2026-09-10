import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPayable } from './create-payable';
import { addAbono } from './add-abono';
import { editAbono } from './edit-abono';
import { deleteAbono } from './delete-abono';
import { editTotal } from './edit-total';
import { deletePayable } from './delete-payable';
import { Payable } from '../../domain/payable';
import { Movement } from '../../domain/movement';
import { Category } from '../../domain/category';
import { Account } from '../../domain/account';
import { Money } from '../../domain/money';
import type { Currency } from '../../domain/currency';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors';
import type { PayableRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { TransactionHandle } from '../../domain/transaction';
import type { IdGenerator, UnitOfWork } from '../ports';
import type { PayableAbono } from '../../domain/payable';

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

function fakePayableRepo(
  overrides: Partial<PayableRepository> = {},
): PayableRepository & { created: Payable[]; updated: Payable[]; deleted: string[]; abonosAdded: { payableId: string; abono: AbonoRecord }[]; abonosEdited: { payableId: string; abonoId: string; updates: Partial<{ amount: number; date: Date; movementId: string }> }[]; abonosDeleted: { payableId: string; abonoId: string }[] } {
  const created: Payable[] = [];
  const updated: Payable[] = [];
  const deleted: string[] = [];
  const abonosAdded: { payableId: string; abono: AbonoRecord }[] = [];
  const abonosEdited: { payableId: string; abonoId: string; updates: Partial<{ amount: number; date: Date; movementId: string }> }[] = [];
  const abonosDeleted: { payableId: string; abonoId: string }[] = [];
  return {
    created,
    updated,
    deleted,
    abonosAdded,
    abonosEdited,
    abonosDeleted,
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (payable: Payable) => {
      created.push(payable);
      return payable;
    }),
    update: vi.fn().mockImplementation(async (payable: Payable) => {
      updated.push(payable);
      return payable;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    addAbono: vi.fn().mockImplementation(async (_userId: string, payableId: string, abono: AbonoRecord) => {
      abonosAdded.push({ payableId, abono });
    }),
    editAbono: vi.fn().mockImplementation(async (_userId: string, payableId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>) => {
      abonosEdited.push({ payableId, abonoId, updates });
    }),
    deleteAbono: vi.fn().mockImplementation(async (_userId: string, payableId: string, abonoId: string) => {
      abonosDeleted.push({ payableId, abonoId });
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
    findByAccountIdForBalance: vi.fn().mockResolvedValue([]),
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

function makePayable(
  overrides: Partial<ConstructorParameters<typeof Payable>[0]> = {},
  abonos: PayableAbono[] = [],
): Payable {
  return new Payable(
    {
      id: 'pay-1',
      workspaceId: 'user-1',
      counterparty: 'Proveedor SA',
      total: new Money(100000, 'COP'),
      initialPayment: 0,
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
    category: new Category({ id: 'cat-1', workspaceId: 'user-1', name: 'Payable', type, createdAt: new Date() }),
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

describe('createPayable', () => {
  it('creates a payable with zero movements when there is no initial payment (H10)', async () => {
    const payableRepo = fakePayableRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const payable = await createPayable(
      'user-1',
      {
        counterparty: 'Proveedor SA',
        total: 100000,
        currency: 'COP',
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
      },
      payableRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );

    expect(payable.counterparty).toBe('Proveedor SA');
    expect(payable.total.amount).toBe(100000);
    expect(payable.total.currency).toBe('COP');
    expect(payable.initialPayment).toBe(0);
    expect(payable.pending).toBe(100000);
    expect(payableRepo.created).toHaveLength(1);
    // The purchase itself NEVER generates a movement
    expect(movementRepo.created).toHaveLength(0);
  });

  it('creates exactly ONE expense movement when initial payment > 0 (H10)', async () => {
    const payableRepo = fakePayableRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const payable = await createPayable(
      'user-1',
      {
        counterparty: 'Proveedor SA',
        total: 100000,
        currency: 'COP',
        initialPayment: 30000,
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
      },
      payableRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );

    expect(payable.initialPayment).toBe(30000);
    expect(payable.pending).toBe(70000);
    expect(movementRepo.created).toHaveLength(1);

    const movement = movementRepo.created[0];
    expect(movement.type).toBe('expense');
    expect(movement.signedAmount).toBe(-30000);
    expect(movement.amount.amount).toBe(30000);
    expect(movement.accountId).toBe('acc-1');
    expect(movement.link?.kind).toBe('payableInitialPayment');
    expect(movement.link?.refId).toBe(payable.id);
  });

  it('creates a fully-paid payable with one movement of the full total', async () => {
    const payableRepo = fakePayableRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const payable = await createPayable(
      'user-1',
      {
        counterparty: 'Proveedor SA',
        total: 50000,
        currency: 'COP',
        initialPayment: 50000,
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
      },
      payableRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );

    expect(payable.pending).toBe(0);
    expect(movementRepo.created).toHaveLength(1);
    expect(movementRepo.created[0].amount.amount).toBe(50000);
  });

  it('sets context to Personal (hardcoded) for payable initial payment movement', async () => {
    const payableRepo = fakePayableRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await createPayable(
      'user-1',
      {
        counterparty: 'Proveedor SA',
        total: 100000,
        currency: 'COP',
        initialPayment: 30000,
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
      },
      payableRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );

    expect(movementRepo.created[0].context).toBe('Personal');
  });

  it('throws NotFoundError when the payment account does not exist (D3 tenant guard)', async () => {
    const payableRepo = fakePayableRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([]);
    const ids = fakeIdGen();

    await expect(
      createPayable(
        'user-1',
        {
          counterparty: 'Proveedor SA',
          total: 100000,
          currency: 'COP',
          accountId: 'acc-missing',
          date: new Date('2025-06-01'),
        },
        payableRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('persists dueDate and note', async () => {
    const payableRepo = fakePayableRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();
    const dueDate = new Date('2025-07-15');

    const payable = await createPayable(
      'user-1',
      {
        counterparty: 'Proveedor SA',
        total: 100000,
        currency: 'COP',
          accountId: 'acc-1',
          date: new Date('2025-06-01'),
          dueDate,
          note: 'Compra de perfume',
        },
        payableRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
    );

    expect(payable.dueDate).toEqual(dueDate);
    expect(payable.note).toBe('Compra de perfume');
  });

  it('rejects initialPayment greater than total', async () => {
    const payableRepo = fakePayableRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createPayable(
        'user-1',
        {
          counterparty: 'Proveedor SA',
          total: 100000,
          currency: 'COP',
          initialPayment: 150000,
          accountId: 'acc-1',
          date: new Date(),
        },
        payableRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);
    // Nothing written when validation fails
    expect(payableRepo.created).toHaveLength(0);
    expect(movementRepo.created).toHaveLength(0);
  });

  it('rejects negative initialPayment and empty counterparty', async () => {
    const payableRepo = fakePayableRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createPayable(
        'user-1',
        {
          counterparty: 'Proveedor SA',
          total: 100000,
          currency: 'COP',
          initialPayment: -1,
          accountId: 'acc-1',
          date: new Date(),
        },
        payableRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);

    await expect(
      createPayable(
        'user-1',
        {
          counterparty: '   ',
          total: 100000,
          currency: 'COP',
          accountId: 'acc-1',
          date: new Date(),
        },
        payableRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);

    expect(payableRepo.created).toHaveLength(0);
    expect(movementRepo.created).toHaveLength(0);
  });

  it('throws ValidationError when the payable currency does not match the account currency (ACC-1)', async () => {
    const payableRepo = fakePayableRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1', 'USD')]);
    const ids = fakeIdGen();

    await expect(
      createPayable(
        'user-1',
        {
          counterparty: 'Proveedor SA',
          total: 100000,
          currency: 'COP',
          accountId: 'acc-1',
          date: new Date('2025-06-01'),
        },
        payableRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);

    expect(payableRepo.created).toHaveLength(0);
    expect(movementRepo.created).toHaveLength(0);
  });
});

// ─── Add Abono ─────────────────────────────────────────────────────

describe('addAbono', () => {
  it('adds an abono accounting for the initial payment and creates expense movement', async () => {
    const payable = makePayable({ initialPayment: 20000 });
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const result = await addAbono(
      'user-1',
      'pay-1',
      { amount: 30000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
      payableRepo,
      movementRepo,
      ids,
      accountRepo, fakeUow());

    expect(result.abonos).toHaveLength(1);
    expect(result.abonos[0].amount.amount).toBe(30000);
    // pending = 100000 − 20000 − 30000
    expect(result.pending).toBe(50000);
    expect(payableRepo.addAbono).toHaveBeenCalledOnce();
    expect(movementRepo.created).toHaveLength(1);

    const movement = movementRepo.created[0];
    expect(movement.type).toBe('expense');
    expect(movement.amount.amount).toBe(30000);
    expect(movement.signedAmount).toBe(-30000);
    expect(movement.link?.kind).toBe('payableAbono');
    expect(movement.link?.refId).toBe('pay-1');
  });

  it('sets context to Personal (hardcoded) for payable abono movement', async () => {
    const payable = makePayable(); // payable.accountId = acc-1
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await addAbono(
      'user-1',
      'pay-1',
      { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
      payableRepo,
      movementRepo,
      ids,
      accountRepo, fakeUow());

    const movement = movementRepo.created[0];
    expect(movement.accountId).toBe('acc-1');
    expect(movement.context).toBe('Personal');
  });

  it('throws ValidationError when the payment account currency differs from the abono currency (ACC-1)', async () => {
    const payable = makePayable(); // payable.total is COP
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();
    // Payment account is USD but the abono is COP — the movement would be
    // re-labeled to USD on read, silently corrupting the ledger.
    const accountRepo = fakeAccountRepo([makeAccount('acc-1', 'USD')]);
    const ids = fakeIdGen();

    await expect(
      addAbono(
        'user-1',
        'pay-1',
        { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
        payableRepo,
        movementRepo,
        ids,
        accountRepo, fakeUow()),
    ).rejects.toThrow(ValidationError);

    expect(payableRepo.addAbono).not.toHaveBeenCalled();
    expect(movementRepo.created).toHaveLength(0);
  });

  it('throws ConflictError on overpayment including initial payment (PAY-R-2)', async () => {
    const payable = makePayable({ initialPayment: 50000 });
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    // pending is 50000; 60000 exceeds it
    await expect(
      addAbono(
        'user-1',
        'pay-1',
        { amount: 60000, currency: 'COP', accountId: 'acc-1', date: new Date() },
        payableRepo,
        movementRepo,
        ids,
        accountRepo, fakeUow()),
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError on any positive abono when pending is 0', async () => {
    const payable = makePayable({ initialPayment: 100000 });
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      addAbono(
        'user-1',
        'pay-1',
        { amount: 1000, currency: 'COP', accountId: 'acc-1', date: new Date() },
        payableRepo,
        movementRepo,
        ids,
        accountRepo, fakeUow()),
    ).rejects.toThrow(ConflictError);
    expect(movementRepo.created).toHaveLength(0);
  });

  it('throws NotFoundError when payable does not exist', async () => {
    const payableRepo = fakePayableRepo({
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
        payableRepo,
        movementRepo,
        ids,
        accountRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the payment account does not exist (D3)', async () => {
    const payable = makePayable();
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([]);
    const ids = fakeIdGen();

    await expect(
      addAbono(
        'user-1',
        'pay-1',
        { amount: 25000, currency: 'COP', accountId: 'acc-missing', date: new Date() },
        payableRepo,
        movementRepo,
        ids,
        accountRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when the abono currency differs from the payable currency (ACC-1)', async () => {
    const payable = makePayable({ total: new Money(100000, 'USD') });
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1', 'USD')]);
    const ids = fakeIdGen();

    await expect(
      addAbono(
        'user-1',
        'pay-1',
        { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
        payableRepo,
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
    const payable = makePayable({ initialPayment: 10000 }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const existingMovement = makeMovement({ id: 'mov-1', amount: new Money(25000, 'COP') });

    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existingMovement),
    });

    const result = await editAbono(
      'user-1',
      'pay-1',
      'ab-1',
      { amount: 30000 },
      payableRepo,
      movementRepo, fakeUow());

    expect(result.abonos[0].amount.amount).toBe(30000);
    // pending = 100000 − 10000 − 30000
    expect(result.pending).toBe(60000);
    expect(payableRepo.editAbono).toHaveBeenCalledOnce();
    expect(movementRepo.updated).toHaveLength(1);
    expect(movementRepo.updated[0].amount.amount).toBe(30000);
    expect(movementRepo.updated[0].signedAmount).toBe(-30000);
  });

  it('keeps invariant pending == derived: embedded abono and movement move together', async () => {
    const payable = makePayable({ initialPayment: 10000 }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const existingMovement = makeMovement({ id: 'mov-1', amount: new Money(25000, 'COP') });

    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existingMovement),
    });

    const result = await editAbono(
      'user-1',
      'pay-1',
      'ab-1',
      { amount: 40000 },
      payableRepo,
      movementRepo, fakeUow());

    // Embedded abono and linked movement must end with the SAME amount
    expect(payableRepo.abonosEdited[0].updates.amount).toBe(40000);
    expect(movementRepo.updated[0].amount.amount).toBe(40000);
    expect(result.pending).toBe(50000);
  });

  it('skips movement update when abono has no movementId', async () => {
    const payable = makePayable({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await editAbono(
      'user-1',
      'pay-1',
      'ab-1',
      { amount: 30000 },
      payableRepo,
      movementRepo, fakeUow());

    expect(result.abonos[0].amount.amount).toBe(30000);
    expect(payableRepo.editAbono).toHaveBeenCalledOnce();
    expect(movementRepo.findById).not.toHaveBeenCalled();
    expect(movementRepo.updated).toHaveLength(0);
  });

  it('throws ConflictError when new amount exceeds remaining pending', async () => {
    const payable = makePayable({ initialPayment: 50000 }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();

    // pending excluding this abono = 100000 − 50000 − 0 = 50000; 60000 exceeds
    await expect(
      editAbono('user-1', 'pay-1', 'ab-1', { amount: 60000 }, payableRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects a MODERN payable whose required movement is missing (R15.1 6c)', async () => {
    const payable = makePayable({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-missing' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    // findById resolves null → required movement missing
    const movementRepo = fakeMovementRepo();

    const error = await editAbono(
      'user-1',
      'pay-1',
      'ab-1',
      { amount: 30000 },
      payableRepo,
      movementRepo,
      fakeUow(),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe('Required movement not found for modern record');
    // Fail-fast: the abono write must NOT be performed (tx rolls back)
    expect(payableRepo.abonosEdited).toHaveLength(0);
    expect(movementRepo.updated).toHaveLength(0);
  });

  it('keeps the tolerant behavior for a LEGACY payable with a missing movement (R15.1 6c)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const payable = makePayable({ createdAt: new Date('2026-08-01T00:00:00.000Z') }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-missing' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await editAbono(
      'user-1',
      'pay-1',
      'ab-1',
      { amount: 30000 },
      payableRepo,
      movementRepo, fakeUow());

    expect(result.abonos[0].amount.amount).toBe(30000);
    expect(payableRepo.editAbono).toHaveBeenCalledOnce();
    expect(movementRepo.updated).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[reconcile] Legacy record missing movement, continuing',
      expect.objectContaining({ aggregateId: 'pay-1', movementId: 'mov-missing' }),
    );
    warnSpy.mockRestore();
  });

  it('throws NotFoundError when payable does not exist', async () => {
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      editAbono('user-1', 'missing', 'ab-1', { amount: 30000 }, payableRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when abono does not exist', async () => {
    const payable = makePayable();
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      editAbono('user-1', 'pay-1', 'missing-abono', { amount: 30000 }, payableRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Delete Abono ──────────────────────────────────────────────────

describe('deleteAbono', () => {
  it('removes abono and reverses linked movement', async () => {
    const payable = makePayable({ initialPayment: 20000 }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await deleteAbono('user-1', 'pay-1', 'ab-1', payableRepo, movementRepo, fakeUow());

    expect(result.abonos).toHaveLength(0);
    // pending back to total − initialPayment
    expect(result.pending).toBe(80000);
    expect(payableRepo.deleteAbono).toHaveBeenCalledOnce();
    expect(movementRepo.deleted).toContain('mov-1');
  });

  it('skips movement deletion when abono has no movementId', async () => {
    const payable = makePayable({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await deleteAbono('user-1', 'pay-1', 'ab-1', payableRepo, movementRepo, fakeUow());

    expect(result.abonos).toHaveLength(0);
    expect(result.pending).toBe(100000);
    expect(movementRepo.delete).not.toHaveBeenCalled();
  });

  it('deletes the linked movement BEFORE pulling the abono (R5-B atomicity)', async () => {
    const payable = makePayable({ initialPayment: 20000 }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const deleteAbonoMock = vi.fn().mockImplementation(async () => {});
    const deleteMovementMock = vi.fn().mockImplementation(async () => {});
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
      deleteAbono: deleteAbonoMock,
    });
    const movementRepo = fakeMovementRepo({ delete: deleteMovementMock });

    await deleteAbono('user-1', 'pay-1', 'ab-1', payableRepo, movementRepo, fakeUow());

    expect(deleteMovementMock.mock.invocationCallOrder[0])
      .toBeLessThan(deleteAbonoMock.mock.invocationCallOrder[0]);
  });

  it('tolerates an already-missing movement when deleting an abono (R5-B)', async () => {
    const payable = makePayable({ initialPayment: 20000 }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo({
      delete: vi.fn().mockRejectedValue(new NotFoundError('Movement not found')),
    });

    const result = await deleteAbono('user-1', 'pay-1', 'ab-1', payableRepo, movementRepo, fakeUow());

    expect(result.abonos).toHaveLength(0);
    expect(payableRepo.deleteAbono).toHaveBeenCalledOnce();
    expect(movementRepo.deleted).toHaveLength(0);
  });

  it('propagates non-NotFound movement errors WITHOUT pulling the abono (R5-B)', async () => {
    const payable = makePayable({ initialPayment: 20000 }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo({
      delete: vi.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(
      deleteAbono('user-1', 'pay-1', 'ab-1', payableRepo, movementRepo, fakeUow()),
    ).rejects.toThrow('db down');

    expect(payableRepo.deleteAbono).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when payable does not exist', async () => {
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteAbono('user-1', 'missing', 'ab-1', payableRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when abono does not exist', async () => {
    const payable = makePayable();
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteAbono('user-1', 'pay-1', 'missing-abono', payableRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Edit Total ────────────────────────────────────────────────────

describe('editTotal', () => {
  it('updates total only — no movement cascade exists for payables', async () => {
    const payable = makePayable({ initialPayment: 20000 }, [
      { id: 'ab-1', amount: new Money(30000, 'COP'), date: new Date(), accountId: 'acc-1' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await editTotal(
      'user-1',
      'pay-1',
      { total: 120000, currency: 'COP' },
      payableRepo,
    );

    expect(result.total.amount).toBe(120000);
    expect(result.pending).toBe(70000);
    expect(payableRepo.update).toHaveBeenCalledOnce();
    // No principal movement exists → nothing to cascade
    expect(movementRepo.updated).toHaveLength(0);
  });

  it('accepts a new total equal to what was already paid (pending becomes 0)', async () => {
    const payable = makePayable({ initialPayment: 40000 }, [
      { id: 'ab-1', amount: new Money(60000, 'COP'), date: new Date(), accountId: 'acc-1' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });

    const result = await editTotal(
      'user-1',
      'pay-1',
      { total: 100000, currency: 'COP' },
      payableRepo,
    );

    expect(result.pending).toBe(0);
  });

  it('throws ConflictError when new total is below paid amount (PAY-R-4)', async () => {
    const payable = makePayable({ initialPayment: 30000 }, [
      { id: 'ab-1', amount: new Money(40000, 'COP'), date: new Date(), accountId: 'acc-1' },
    ]);
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });

    // paid = 70000; 60000 < paid
    await expect(
      editTotal('user-1', 'pay-1', { total: 60000, currency: 'COP' }, payableRepo),
    ).rejects.toThrow(ConflictError);
    expect(payableRepo.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when payable does not exist', async () => {
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });

    await expect(
      editTotal('user-1', 'missing', { total: 200000, currency: 'COP' }, payableRepo),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when changing the total currency (ACC-1)', async () => {
    const payable = makePayable();
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });

    await expect(
      editTotal('user-1', 'pay-1', { total: 200000, currency: 'USD' }, payableRepo),
    ).rejects.toThrow(ValidationError);
    expect(payableRepo.update).not.toHaveBeenCalled();
  });
});

// ─── Delete Payable ────────────────────────────────────────────────

describe('deletePayable', () => {
  it('cascade-deletes all linked movements via deleteByRefId then the payable', async () => {
    const payable = makePayable({ initialPayment: 20000 }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date(), accountId: 'acc-1', movementId: 'mov-abono' },
    ]);

    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();

    await deletePayable('user-1', 'pay-1', payableRepo, movementRepo, fakeUow());

    // deleteByRefId is a format-agnostic deleteMany (initial payment + abonos).
    expect(movementRepo.deleteByRefId).toHaveBeenCalledWith('user-1', 'pay-1', expect.anything());
    expect(payableRepo.deleted).toContain('pay-1');
  });

  it('deletes the record even when no movements are linked', async () => {
    const payable = makePayable(); // no initialPayment, no abonos
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo();

    await deletePayable('user-1', 'pay-1', payableRepo, movementRepo, fakeUow());

    expect(movementRepo.deleteByRefId).toHaveBeenCalledWith('user-1', 'pay-1', expect.anything());
    expect(payableRepo.deleted).toContain('pay-1');
  });

  it('is tolerant of an already-deleted linked movement (R5-B) and still deletes the payable', async () => {
    const payable = makePayable({ initialPayment: 20000 }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date(), accountId: 'acc-1', movementId: 'mov-already-gone' },
    ]);

    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([payable]),
    });
    const movementRepo = fakeMovementRepo({
      // deleteByRefId is tolerant by construction: a deleteMany reports 0 for
      // already-missing movements, never a NotFoundError.
      deleteByRefId: vi.fn().mockResolvedValue(0),
    });

    await expect(
      deletePayable('user-1', 'pay-1', payableRepo, movementRepo, fakeUow()),
    ).resolves.toBeUndefined();
    expect(payableRepo.deleted).toContain('pay-1');
  });

  it('throws NotFoundError when payable does not exist', async () => {
    const payableRepo = fakePayableRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deletePayable('user-1', 'missing', payableRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
    expect(movementRepo.deleteByRefId).not.toHaveBeenCalled();
    expect(payableRepo.delete).not.toHaveBeenCalled();
  });
});
