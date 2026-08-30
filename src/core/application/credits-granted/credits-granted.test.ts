import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreditGranted } from './create-credit-granted';
import { addAbono } from './add-abono';
import { editAbono } from './edit-abono';
import { deleteAbono } from './delete-abono';
import { editPrincipal } from './edit-principal';
import { deleteCreditGranted } from './delete-credit-granted';
import { markAsPaid } from './mark-as-paid';
import { writeOffCreditGranted } from './write-off-credit-granted';
import {
  WRITE_OFF_ALREADY_MSG,
  WRITE_OFF_PAID_MSG,
  WRITE_OFF_NO_LOSS_MSG,
} from './write-off-credit-granted';
import { CreditGranted } from '../../domain/credit-granted';
import { Movement } from '../../domain/movement';
import { Category } from '../../domain/category';
import { Account } from '../../domain/account';
import { Money, MoneyError } from '../../domain/money';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors';
import type { CreditGrantedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreditAbono } from '../../domain/credit-granted';

// ─── Fake factories ────────────────────────────────────────────────

let idCounter = 0;

interface AbonoRecord {
  id: string;
  amount: number;
  date: Date;
  accountId: string;
  movementId?: string;
  capitalAmount?: number;
  interestAmount?: number;
  interestMovementId?: string;
}

function fakeAccountRepo(
  accounts: Account[] = [],
): AccountRepository {
  return {
    findById: vi.fn().mockImplementation(async (_userId: string, id: string) =>
      accounts.find((a) => a.id === id) ?? null,
    ),
    findByUserId: vi.fn().mockResolvedValue(accounts),
    create: vi.fn().mockImplementation(async (account: Account) => account),
    update: vi.fn().mockImplementation(async (account: Account) => account),
    delete: vi.fn().mockResolvedValue(undefined),
    countReferences: vi.fn().mockResolvedValue(0),
  };
}

function makeAccount(
  id: string,
): Account {
  return new Account({
    id,
    userId: 'user-1',
    name: `Account ${id}`,
    currency: 'COP',
    isFixed: false,
    createdAt: new Date(),
  });
}

function fakeCreditRepo(
  overrides: Partial<CreditGrantedRepository> = {},
): CreditGrantedRepository & { created: CreditGranted[]; updated: CreditGranted[]; deleted: string[]; abonosAdded: { creditId: string; abono: AbonoRecord }[]; abonosEdited: { creditId: string; abonoId: string; updates: Partial<{ amount: number; date: Date; movementId: string; capitalAmount: number; interestAmount: number; interestMovementId: string }> }[]; abonosDeleted: { creditId: string; abonoId: string }[]; writtenOff: { userId: string; creditId: string; writtenOff: { date: Date; movementId: string } }[] } {
  const created: CreditGranted[] = [];
  const updated: CreditGranted[] = [];
  const deleted: string[] = [];
  const abonosAdded: { creditId: string; abono: AbonoRecord }[] = [];
  const abonosEdited: { creditId: string; abonoId: string; updates: Partial<{ amount: number; date: Date; movementId: string; capitalAmount: number; interestAmount: number; interestMovementId: string }> }[] = [];
  const abonosDeleted: { creditId: string; abonoId: string }[] = [];
  const writtenOff: { userId: string; creditId: string; writtenOff: { date: Date; movementId: string } }[] = [];
  return {
    created,
    updated,
    deleted,
    abonosAdded,
    abonosEdited,
    abonosDeleted,
    writtenOff,
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (credit: CreditGranted) => {
      created.push(credit);
      return credit;
    }),
    update: vi.fn().mockImplementation(async (credit: CreditGranted) => {
      updated.push(credit);
      return credit;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    addAbono: vi.fn().mockImplementation(async (_userId: string, creditId: string, abono: AbonoRecord) => {
      abonosAdded.push({ creditId, abono });
    }),
    editAbono: vi.fn().mockImplementation(async (_userId: string, creditId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string; capitalAmount: number; interestAmount: number; interestMovementId: string }>) => {
      abonosEdited.push({ creditId, abonoId, updates });
    }),
    deleteAbono: vi.fn().mockImplementation(async (_userId: string, creditId: string, abonoId: string) => {
      abonosDeleted.push({ creditId, abonoId });
    }),
    markWrittenOff: vi.fn().mockImplementation(async (userId: string, creditId: string, marker: { date: Date; movementId: string }) => {
      writtenOff.push({ userId, creditId, writtenOff: marker });
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
    findByUserId: vi.fn().mockResolvedValue([]),
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
    ...overrides,
  };
}

function fakeIdGen(): IdGenerator {
  return { generate: () => `id-${++idCounter}` };
}

function makeCredit(
  overrides: Partial<ConstructorParameters<typeof CreditGranted>[0]> = {},
  abonos: CreditAbono[] = [],
): CreditGranted {
  return new CreditGranted(
    {
      id: 'cg-1',
      userId: 'user-1',
      counterparty: 'Pedro',
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
    userId: 'user-1',
    accountId: 'acc-1',
    category: new Category({ id: 'cat-1', userId: 'user-1', name: 'Credit', type, createdAt: new Date() }),
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

describe('createCreditGranted', () => {
  it('creates a credit and principal expense movement (CRED-G-1)', async () => {
    const creditRepo = fakeCreditRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const credit = await createCreditGranted(
      'user-1',
      {
        counterparty: 'Pedro',
        principal: 100000,
        currency: 'COP',
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
      },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    expect(credit.counterparty).toBe('Pedro');
    expect(credit.principal.amount).toBe(100000);
    expect(credit.principal.currency).toBe('COP');
    expect(creditRepo.created).toHaveLength(1);
    expect(movementRepo.created).toHaveLength(1);

    const movement = movementRepo.created[0];
    expect(movement.type).toBe('expense');
    expect(movement.amount.amount).toBe(100000);
    expect(movement.signedAmount).toBe(-100000);
    expect(movement.accountId).toBe('acc-1');
    expect(movement.link?.kind).toBe('creditGrantedPrincipal');
    expect(movement.link?.refId).toBe(credit.id);
  });

  it('sets context to Personal (hardcoded) for credit granted principal movement', async () => {
    const creditRepo = fakeCreditRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await createCreditGranted(
      'user-1',
      {
        counterparty: 'Pedro',
        principal: 100000,
        currency: 'COP',
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
      },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    expect(movementRepo.created[0].context).toBe('Personal');
  });

  it('creates credit with optional installments and frequency', async () => {
    const creditRepo = fakeCreditRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const credit = await createCreditGranted(
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
    );

    expect(credit.installments).toBe(12);
    expect(credit.installmentValue?.amount).toBe(10000);
    expect(credit.totalToPay).toBe(120000);
    expect(credit.frequency).toBe('monthly');
  });

  it('rejects zero principal — standalone credits stay strictly positive (H14 zero is sale-born only)', async () => {
    const creditRepo = fakeCreditRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    // The strict Money constructor keeps the standalone flow unchanged:
    // only createSale may mint a zero-principal credit (born paid-in-full).
    await expect(
      createCreditGranted(
        'user-1',
        {
          counterparty: 'Pedro',
          principal: 0,
          currency: 'COP',
          accountId: 'acc-1',
          date: new Date('2025-06-01'),
        },
        creditRepo,
        movementRepo,
        ids,
        accountRepo,
      ),
    ).rejects.toThrow(MoneyError);
    expect(creditRepo.created).toHaveLength(0);
    expect(movementRepo.created).toHaveLength(0);
  });
});

// ─── Add Abono ─────────────────────────────────────────────────────

describe('addAbono', () => {
  it('adds an abono and creates income movement (debtor pays back)', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const result = await addAbono(
      'user-1',
      'cg-1',
      { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    expect(result.abonos).toHaveLength(1);
    expect(result.abonos[0].amount.amount).toBe(25000);
    expect(result.pending).toBe(75000);
    expect(creditRepo.addAbono).toHaveBeenCalledOnce();
    expect(movementRepo.created).toHaveLength(1);

    const movement = movementRepo.created[0];
    expect(movement.type).toBe('income');
    expect(movement.amount.amount).toBe(25000);
    expect(movement.signedAmount).toBe(25000);
    expect(movement.link?.kind).toBe('creditGrantedAbono');
  });

  it('sets context to Personal (hardcoded) for credit granted abono movement', async () => {
    const credit = makeCredit(); // credit.accountId = acc-1
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await addAbono(
      'user-1',
      'cg-1',
      { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    const movement = movementRepo.created[0];
    expect(movement.accountId).toBe('acc-1');
    expect(movement.context).toBe('Personal');
  });

  it('throws ConflictError on overpayment (CRED-G-2)', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      addAbono(
        'user-1',
        'cg-1',
        { amount: 150000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
        creditRepo,
        movementRepo,
        ids,
        accountRepo,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
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
        accountRepo,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Edit Abono ────────────────────────────────────────────────────

describe('editAbono', () => {
  it('edits abono amount and updates linked movement (income type)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const existingMovement = makeMovement({ id: 'mov-1', type: 'income', amount: new Money(25000, 'COP') });

    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existingMovement),
    });
    const ids = fakeIdGen();

    const result = await editAbono(
      'user-1',
      'cg-1',
      'ab-1',
      { amount: 30000 },
      creditRepo,
      movementRepo,
      ids,
    );

    expect(result.abonos[0].amount.amount).toBe(30000);
    expect(result.pending).toBe(70000);
    expect(creditRepo.editAbono).toHaveBeenCalledOnce();
    expect(movementRepo.updated).toHaveLength(1);
    expect(movementRepo.updated[0].amount.amount).toBe(30000);
    expect(movementRepo.updated[0].signedAmount).toBe(30000);
  });

  it('keeps saldo == sum(movements): embedded abono and movement move together', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const existingMovement = makeMovement({ id: 'mov-1', type: 'income', amount: new Money(25000, 'COP') });

    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existingMovement),
    });
    const ids = fakeIdGen();

    const result = await editAbono(
      'user-1',
      'cg-1',
      'ab-1',
      { amount: 40000 },
      creditRepo,
      movementRepo,
      ids,
    );

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
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    const result = await editAbono(
      'user-1',
      'cg-1',
      'ab-1',
      { amount: 30000 },
      creditRepo,
      movementRepo,
      ids,
    );

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
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    await expect(
      editAbono('user-1', 'cg-1', 'ab-1', { amount: 200000 }, creditRepo, movementRepo, ids),
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    await expect(
      editAbono('user-1', 'missing', 'ab-1', { amount: 30000 }, creditRepo, movementRepo, ids),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when abono does not exist', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    await expect(
      editAbono('user-1', 'cg-1', 'missing-abono', { amount: 30000 }, creditRepo, movementRepo, ids),
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
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await deleteAbono('user-1', 'cg-1', 'ab-1', creditRepo, movementRepo);

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
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await deleteAbono('user-1', 'cg-1', 'ab-1', creditRepo, movementRepo);

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
      findByUserId: vi.fn().mockResolvedValue([credit]),
      deleteAbono: deleteAbonoMock,
    });
    const movementRepo = fakeMovementRepo({ delete: deleteMovementMock });

    await deleteAbono('user-1', 'cg-1', 'ab-1', creditRepo, movementRepo);

    // Movement first, then $pull: a mid-way failure leaves the abono intact
    // (debt still pending, no phantom movement inflating balances).
    expect(deleteMovementMock.mock.invocationCallOrder[0])
      .toBeLessThan(deleteAbonoMock.mock.invocationCallOrder[0]);
  });

  it('tolerates an already-missing movement when deleting an abono (R5-B)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      delete: vi.fn().mockRejectedValue(new NotFoundError('Movement not found')),
    });

    const result = await deleteAbono('user-1', 'cg-1', 'ab-1', creditRepo, movementRepo);

    // The abono pull still happens: a movement that is already gone must not
    // block removing its abono.
    expect(result.abonos).toHaveLength(0);
    expect(creditRepo.deleteAbono).toHaveBeenCalledOnce();
    expect(movementRepo.deleted).toHaveLength(0);
  });

  it('propagates non-NotFound movement errors WITHOUT pulling the abono (R5-B)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      delete: vi.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(
      deleteAbono('user-1', 'cg-1', 'ab-1', creditRepo, movementRepo),
    ).rejects.toThrow('db down');

    expect(creditRepo.deleteAbono).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteAbono('user-1', 'missing', 'ab-1', creditRepo, movementRepo),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when abono does not exist', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteAbono('user-1', 'cg-1', 'missing-abono', creditRepo, movementRepo),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Edit Principal ────────────────────────────────────────────────

describe('editPrincipal', () => {
  it('updates principal and cascades to principal movement (expense type)', async () => {
    const credit = makeCredit();
    const principalMovement = makeMovement({
      id: 'mov-principal',
      type: 'expense',
      amount: new Money(100000, 'COP'),
      link: { kind: 'creditGrantedPrincipal', refId: 'cg-1', opId: 'op-1' },
    });

    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue([principalMovement]),
    });

    const result = await editPrincipal(
      'user-1',
      'cg-1',
      { principal: 200000, currency: 'COP' },
      creditRepo,
      movementRepo,
    );

    expect(result.principal.amount).toBe(200000);
    expect(creditRepo.update).toHaveBeenCalledOnce();
    expect(movementRepo.updated).toHaveLength(1);
    expect(movementRepo.updated[0].amount.amount).toBe(200000);
  });

  it('still updates credit when principal movement does not exist', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
    });

    const result = await editPrincipal(
      'user-1',
      'cg-1',
      { principal: 200000, currency: 'COP' },
      creditRepo,
      movementRepo,
    );

    expect(result.principal.amount).toBe(200000);
    expect(creditRepo.update).toHaveBeenCalledOnce();
    expect(movementRepo.updated).toHaveLength(0);
  });

  it('throws ConflictError when new principal < total abonos (CRED-G-5)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(50000, 'COP'), date: new Date(), accountId: 'acc-1' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      editPrincipal('user-1', 'cg-1', { principal: 30000, currency: 'COP' }, creditRepo, movementRepo),
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      editPrincipal('user-1', 'missing', { principal: 200000, currency: 'COP' }, creditRepo, movementRepo),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Delete Credit ─────────────────────────────────────────────────

describe('deleteCreditGranted', () => {
  it('cascade-deletes all linked movements then the credit', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date(), accountId: 'acc-1', movementId: 'mov-abono' },
    ]);
    const principalMov = makeMovement({
      id: 'mov-principal',
      type: 'expense',
      link: { kind: 'creditGrantedPrincipal', refId: 'cg-1', opId: 'op-1' },
    });
    const abonoMov = makeMovement({
      id: 'mov-abono',
      type: 'income',
      link: { kind: 'creditGrantedAbono', refId: 'cg-1', opId: 'op-2' },
    });

    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue([principalMov, abonoMov]),
    });

    await deleteCreditGranted('user-1', 'cg-1', creditRepo, movementRepo);

    expect(movementRepo.deleted).toContain('mov-principal');
    expect(movementRepo.deleted).toContain('mov-abono');
    expect(movementRepo.delete).toHaveBeenCalledTimes(2);
    expect(creditRepo.deleted).toContain('cg-1');
  });

  it('blocks deletion of a sale-born credit and deletes nothing (R5-D0c)', async () => {
    const credit = makeCredit({ saleId: 'sale-1' }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date(), accountId: 'acc-1', movementId: 'mov-abono' },
    ]);
    const principalMov = makeMovement({
      id: 'mov-principal',
      type: 'expense',
      link: { kind: 'creditGrantedPrincipal', refId: 'cg-1', opId: 'op-1' },
    });
    const abonoMov = makeMovement({
      id: 'mov-abono',
      type: 'income',
      link: { kind: 'creditGrantedAbono', refId: 'cg-1', opId: 'op-2' },
    });

    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue([principalMov, abonoMov]),
    });

    await expect(
      deleteCreditGranted('user-1', 'cg-1', creditRepo, movementRepo),
    ).rejects.toThrow(ConflictError);

    // Nothing was deleted — the sale cascade is the only deletion path.
    expect(movementRepo.delete).not.toHaveBeenCalled();
    expect(creditRepo.deleted).toHaveLength(0);
  });

  it('tolerates an already-deleted movement when cascading a standalone credit (R5-D0c)', async () => {
    const credit = makeCredit({});
    const abonoMov = makeMovement({
      id: 'mov-abono',
      type: 'income',
      link: { kind: 'creditGrantedAbono', refId: 'cg-1', opId: 'op-1' },
    });

    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue([abonoMov]),
      // Concurrent deletion already removed the movement before we delete it.
      delete: vi.fn().mockRejectedValue(new NotFoundError('Movement already deleted')),
    });

    await expect(
      deleteCreditGranted('user-1', 'cg-1', creditRepo, movementRepo),
    ).resolves.toBeUndefined();

    expect(creditRepo.deleted).toContain('cg-1');
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteCreditGranted('user-1', 'missing', creditRepo, movementRepo),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── R9/D9.1 — addAbono capital/interest split ─────────────────────

describe('addAbono — capital/interest split (R9)', () => {
  it('first abono recovers capital only — 1 capital movement, no interest', async () => {
    const credit = makeCredit({ installments: 2, installmentValue: new Money(55000, 'COP') });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const result = await addAbono(
      'user-1',
      'cg-1',
      { amount: 55000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    const abono = result.abonos[0];
    expect(abono.capitalAmount?.amount).toBe(55000);
    expect(abono.interestAmount).toBeUndefined();
    expect(abono.interestMovementId).toBeUndefined();
    expect(movementRepo.created).toHaveLength(1);
    expect(movementRepo.created[0].link?.kind).toBe('creditGrantedAbono');
    expect(movementRepo.created[0].amount.amount).toBe(55000);
    expect(abono.movementId).toBe(movementRepo.created[0].id);
    expect(creditRepo.abonosAdded[0].abono.capitalAmount).toBe(55000);
    expect(creditRepo.abonosAdded[0].abono.interestAmount).toBeUndefined();
  });

  it('second abono splits into capital recovery + realized interest (2 movements)', async () => {
    const credit = makeCredit({ installments: 2, installmentValue: new Money(55000, 'COP') }, [
      { id: 'ab-1', amount: new Money(55000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'm-ab1', capitalAmount: new Money(55000, 'COP') },
    ]);
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const result = await addAbono(
      'user-1',
      'cg-1',
      { amount: 55000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-08-01') },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    const abono = result.abonos[1];
    expect(abono.capitalAmount?.amount).toBe(45000);
    expect(abono.interestAmount?.amount).toBe(10000);
    expect(movementRepo.created).toHaveLength(2);
    // capital recovery first, interest second — both Personal context
    expect(movementRepo.created[0].link?.kind).toBe('creditGrantedAbono');
    expect(movementRepo.created[0].amount.amount).toBe(45000);
    expect(movementRepo.created[0].context).toBe('Personal');
    expect(movementRepo.created[1].link?.kind).toBe('creditGrantedAbonoInterest');
    expect(movementRepo.created[1].amount.amount).toBe(10000);
    expect(movementRepo.created[1].context).toBe('Personal');
    expect(abono.movementId).toBe(movementRepo.created[0].id);
    expect(abono.interestMovementId).toBe(movementRepo.created[1].id);
    expect(creditRepo.abonosAdded[0].abono.capitalAmount).toBe(45000);
    expect(creditRepo.abonosAdded[0].abono.interestAmount).toBe(10000);
    expect(creditRepo.abonosAdded[0].abono.interestMovementId).toBe(movementRepo.created[1].id);
  });

  it('100%-interest abono makes the interest movement the PRIMARY one (no capital movement)', async () => {
    const credit = makeCredit({ installments: 2, installmentValue: new Money(60000, 'COP') }, [
      { id: 'ab-1', amount: new Money(100000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'm-ab1', capitalAmount: new Money(100000, 'COP') },
    ]);
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const result = await addAbono(
      'user-1',
      'cg-1',
      { amount: 20000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-08-01') },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    const abono = result.abonos[1];
    expect(abono.capitalAmount).toBeUndefined();
    expect(abono.interestAmount?.amount).toBe(20000);
    expect(abono.interestMovementId).toBeUndefined();
    expect(movementRepo.created).toHaveLength(1);
    expect(movementRepo.created[0].link?.kind).toBe('creditGrantedAbonoInterest');
    expect(movementRepo.created[0].amount.amount).toBe(20000);
    expect(abono.movementId).toBe(movementRepo.created[0].id);
  });

  it('sale-born credit keeps the legacy single-movement behavior (never split)', async () => {
    const credit = makeCredit({ saleId: 'sale-1' });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const result = await addAbono(
      'user-1',
      'cg-1',
      { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    const abono = result.abonos[0];
    expect(abono.capitalAmount).toBeUndefined();
    expect(abono.interestAmount).toBeUndefined();
    expect(abono.interestMovementId).toBeUndefined();
    expect(movementRepo.created).toHaveLength(1);
    expect(movementRepo.created[0].link?.kind).toBe('creditGrantedAbono');
    expect(creditRepo.abonosAdded[0].abono.capitalAmount).toBeUndefined();
  });

  it('sale-born credit abono movement is Business context (commercial activity)', async () => {
    const credit = makeCredit({ saleId: 'sale-1' });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await addAbono(
      'user-1',
      'cg-1',
      { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
      creditRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    expect(movementRepo.created).toHaveLength(1);
    expect(movementRepo.created[0].link?.kind).toBe('creditGrantedAbono');
    expect(movementRepo.created[0].context).toBe('Business');
  });
});

// ─── R9/D9.3 — editAbono split synchronization ─────────────────────

describe('editAbono — split synchronization (R9)', () => {
  it('resyncs both movements when an amount edit shrinks a split abono', async () => {
    const credit = makeCredit({ installments: 2, installmentValue: new Money(65000, 'COP') }, [
      { id: 'ab-1', amount: new Money(65000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'm-cap1', capitalAmount: new Money(65000, 'COP') },
      { id: 'ab-2', amount: new Money(65000, 'COP'), date: new Date('2025-08-01'), accountId: 'acc-1', movementId: 'm-cap2', capitalAmount: new Money(35000, 'COP'), interestAmount: new Money(30000, 'COP'), interestMovementId: 'm-int2' },
    ]);
    const interestMov = makeMovement({
      id: 'm-int2', type: 'income', amount: new Money(30000, 'COP'),
      link: { kind: 'creditGrantedAbonoInterest', refId: 'cg-1', opId: 'op-1' },
    });
    const capitalMov = makeMovement({
      id: 'm-cap2', type: 'income', amount: new Money(35000, 'COP'),
      link: { kind: 'creditGrantedAbono', refId: 'cg-1', opId: 'op-2' },
    });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockImplementation(async (_u: string, id: string) => {
        if (id === 'm-int2') return interestMov;
        if (id === 'm-cap2') return capitalMov;
        return null;
      }),
    });
    const ids = fakeIdGen();

    const result = await editAbono('user-1', 'cg-1', 'ab-2', { amount: 50000 }, creditRepo, movementRepo, ids);

    expect(creditRepo.abonosEdited[0].updates.amount).toBe(50000);
    expect(creditRepo.abonosEdited[0].updates.capitalAmount).toBe(35000);
    expect(creditRepo.abonosEdited[0].updates.interestAmount).toBe(15000);
    expect(creditRepo.abonosEdited[0].updates.interestMovementId).toBe('m-int2');
    expect(movementRepo.updated).toHaveLength(2);
    expect(movementRepo.updated[0].amount.amount).toBe(15000);
    expect(movementRepo.updated[1].amount.amount).toBe(35000);
    expect(movementRepo.created).toHaveLength(0);
    const abono = result.abonos.find(a => a.id === 'ab-2')!;
    expect(abono.amount.amount).toBe(50000);
    expect(abono.capitalAmount?.amount).toBe(35000);
    expect(abono.interestAmount?.amount).toBe(15000);
  });

  it('deletes the interest movement and unsets markers when interest drops to zero', async () => {
    const credit = makeCredit({ installments: 2, installmentValue: new Money(65000, 'COP') }, [
      { id: 'ab-1', amount: new Money(65000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'm-cap1', capitalAmount: new Money(65000, 'COP') },
      { id: 'ab-2', amount: new Money(65000, 'COP'), date: new Date('2025-08-01'), accountId: 'acc-1', movementId: 'm-cap2', capitalAmount: new Money(35000, 'COP'), interestAmount: new Money(30000, 'COP'), interestMovementId: 'm-int2' },
    ]);
    const capitalMov = makeMovement({
      id: 'm-cap2', type: 'income', amount: new Money(35000, 'COP'),
      link: { kind: 'creditGrantedAbono', refId: 'cg-1', opId: 'op-2' },
    });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockImplementation(async (_u: string, id: string) => {
        if (id === 'm-cap2') return capitalMov;
        return null;
      }),
    });
    const ids = fakeIdGen();

    const result = await editAbono('user-1', 'cg-1', 'ab-2', { amount: 35000 }, creditRepo, movementRepo, ids);

    expect(movementRepo.deleted).toContain('m-int2');
    expect(creditRepo.abonosEdited[0].updates.amount).toBe(35000);
    expect(creditRepo.abonosEdited[0].updates.capitalAmount).toBe(35000);
    expect(creditRepo.abonosEdited[0].updates.interestAmount).toBeUndefined();
    expect(creditRepo.abonosEdited[0].updates.interestMovementId).toBeUndefined();
    const abono = result.abonos.find(a => a.id === 'ab-2')!;
    expect(abono.capitalAmount?.amount).toBe(35000);
    expect(abono.interestAmount).toBeUndefined();
    expect(abono.interestMovementId).toBeUndefined();
    expect(movementRepo.created).toHaveLength(0);
  });

  it('creates the interest movement when a fully-capital abono is edited upward', async () => {
    const credit = makeCredit({ installments: 2, installmentValue: new Money(65000, 'COP') }, [
      { id: 'ab-1', amount: new Money(65000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'm-cap1', capitalAmount: new Money(65000, 'COP') },
      { id: 'ab-2', amount: new Money(35000, 'COP'), date: new Date('2025-08-01'), accountId: 'acc-1', movementId: 'm-cap2', capitalAmount: new Money(35000, 'COP') },
    ]);
    const capitalMov = makeMovement({
      id: 'm-cap2', type: 'income', amount: new Money(35000, 'COP'),
      link: { kind: 'creditGrantedAbono', refId: 'cg-1', opId: 'op-2' },
    });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockImplementation(async (_u: string, id: string) => {
        if (id === 'm-cap2') return capitalMov;
        return null;
      }),
    });
    const ids = fakeIdGen();

    const result = await editAbono('user-1', 'cg-1', 'ab-2', { amount: 50000 }, creditRepo, movementRepo, ids);

    expect(movementRepo.created).toHaveLength(1);
    expect(movementRepo.created[0].link?.kind).toBe('creditGrantedAbonoInterest');
    expect(movementRepo.created[0].amount.amount).toBe(15000);
    expect(creditRepo.abonosEdited[0].updates.capitalAmount).toBe(35000);
    expect(creditRepo.abonosEdited[0].updates.interestAmount).toBe(15000);
    expect(creditRepo.abonosEdited[0].updates.interestMovementId).toBe(movementRepo.created[0].id);
    const abono = result.abonos.find(a => a.id === 'ab-2')!;
    expect(abono.interestAmount?.amount).toBe(15000);
    expect(abono.interestMovementId).toBe(movementRepo.created[0].id);
  });

  it('keeps the primary = interest movement on a 100%-interest abono (no duplicate created)', async () => {
    const credit = makeCredit({ installments: 2, installmentValue: new Money(60000, 'COP') }, [
      { id: 'ab-1', amount: new Money(100000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'm-ab1', capitalAmount: new Money(100000, 'COP') },
      { id: 'ab-2', amount: new Money(20000, 'COP'), date: new Date('2025-08-01'), accountId: 'acc-1', movementId: 'm-int', interestAmount: new Money(20000, 'COP') },
    ]);
    const interestMov = makeMovement({
      id: 'm-int', type: 'income', amount: new Money(20000, 'COP'),
      link: { kind: 'creditGrantedAbonoInterest', refId: 'cg-1', opId: 'op-1' },
    });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockImplementation(async (_u: string, id: string) => {
        if (id === 'm-int') return interestMov;
        return null;
      }),
    });
    const ids = fakeIdGen();

    const result = await editAbono('user-1', 'cg-1', 'ab-2', { amount: 20000 }, creditRepo, movementRepo, ids);

    expect(movementRepo.created).toHaveLength(0);
    expect(movementRepo.updated).toHaveLength(1);
    expect(movementRepo.updated[0].id).toBe('m-int');
    expect(movementRepo.updated[0].amount.amount).toBe(20000);
    const abono = result.abonos.find(a => a.id === 'ab-2')!;
    expect(abono.capitalAmount).toBeUndefined();
    expect(abono.interestAmount?.amount).toBe(20000);
    expect(abono.interestMovementId).toBeUndefined();
  });

  it('date-only edit never clears the legacy abono amount ($unset guard)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const existingMovement = makeMovement({ id: 'mov-1', type: 'income', amount: new Money(25000, 'COP') });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existingMovement),
    });
    const ids = fakeIdGen();

    const result = await editAbono(
      'user-1',
      'cg-1',
      'ab-1',
      { date: new Date('2025-08-01') },
      creditRepo,
      movementRepo,
      ids,
    );

    expect(creditRepo.abonosEdited[0].updates.amount).toBe(25000);
    expect(creditRepo.abonosEdited[0].updates.interestAmount).toBeUndefined();
    expect(result.abonos[0].amount.amount).toBe(25000);
  });

  it('reclassifies a legacy sale-born abono movement from Personal to Business context', async () => {
    const credit = makeCredit({ saleId: 'sale-1' }, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const existingMovement = makeMovement({
      id: 'mov-1',
      type: 'income',
      amount: new Money(25000, 'COP'),
      context: 'Personal', // historical erroneous data
      link: { kind: 'creditGrantedAbono', refId: 'cg-1', opId: 'op-1' },
    });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existingMovement),
    });
    const ids = fakeIdGen();

    await editAbono(
      'user-1',
      'cg-1',
      'ab-1',
      { amount: 30000 },
      creditRepo,
      movementRepo,
      ids,
    );

    expect(movementRepo.updated).toHaveLength(1);
    expect(movementRepo.updated[0].context).toBe('Business');
    expect(creditRepo.abonosEdited[0].updates.amount).toBe(30000);
  });
});

// ─── R9/D9.1 — deleteAbono with split-linked movements ─────────────

describe('deleteAbono — split-linked movements (R9)', () => {
  it('deletes interest movement, then primary movement, THEN pulls the abono', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(65000, 'COP'), date: new Date('2025-08-01'), accountId: 'acc-1', movementId: 'm-cap', capitalAmount: new Money(35000, 'COP'), interestAmount: new Money(30000, 'COP'), interestMovementId: 'm-int' },
    ]);
    const deleteAbonoMock = vi.fn().mockImplementation(async () => {});
    const deleteMovementMock = vi.fn().mockImplementation(async () => {});
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
      deleteAbono: deleteAbonoMock,
    });
    const movementRepo = fakeMovementRepo({ delete: deleteMovementMock });

    const result = await deleteAbono('user-1', 'cg-1', 'ab-1', creditRepo, movementRepo);

    expect(deleteMovementMock.mock.calls.map(c => c[1])).toEqual(['m-int', 'm-cap']);
    expect(result.abonos).toHaveLength(0);
    expect(deleteMovementMock.mock.invocationCallOrder[0])
      .toBeLessThan(deleteAbonoMock.mock.invocationCallOrder[0]);
    expect(deleteMovementMock.mock.invocationCallOrder[1])
      .toBeLessThan(deleteAbonoMock.mock.invocationCallOrder[0]);
  });

  it('tolerates an already-missing interest movement and still removes the split abono', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(65000, 'COP'), date: new Date('2025-08-01'), accountId: 'acc-1', movementId: 'm-cap', capitalAmount: new Money(35000, 'COP'), interestAmount: new Money(30000, 'COP'), interestMovementId: 'm-int' },
    ]);
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo({
      delete: vi.fn().mockRejectedValue(new NotFoundError('Movement not found')),
    });

    const result = await deleteAbono('user-1', 'cg-1', 'ab-1', creditRepo, movementRepo);

    expect(result.abonos).toHaveLength(0);
    expect(creditRepo.deleteAbono).toHaveBeenCalledOnce();
  });
});

// ─── R9/D9.4 — writeOffCreditGranted ───────────────────────────────

describe('writeOffCreditGranted', () => {
  it('writes off the full principal when no abonos exist (expense on credit account)', async () => {
    const credit = makeCredit();
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    const result = await writeOffCreditGranted('user-1', 'cg-1', creditRepo, movementRepo, ids);

    expect(movementRepo.created).toHaveLength(1);
    const movement = movementRepo.created[0];
    expect(movement.type).toBe('expense');
    expect(movement.amount.amount).toBe(100000);
    expect(movement.signedAmount).toBe(-100000);
    expect(movement.accountId).toBe('acc-1');
    expect(movement.context).toBe('Personal');
    expect(movement.link?.kind).toBe('creditGrantedWriteOff');
    expect(movement.link?.refId).toBe('cg-1');
    expect(creditRepo.writtenOff).toHaveLength(1);
    expect(creditRepo.writtenOff[0].writtenOff.date).toBeInstanceOf(Date);
    expect(creditRepo.writtenOff[0].writtenOff.movementId).toBe(movement.id);
    expect(result.writtenOff?.movementId).toBe(movement.id);
  });

  it('writes off only the UNRECOVERED capital (recovery reduces the loss)', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(55000, 'COP'), date: new Date('2025-08-01'), accountId: 'acc-1', movementId: 'm-ab1', capitalAmount: new Money(55000, 'COP') },
    ]);
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    await writeOffCreditGranted('user-1', 'cg-1', creditRepo, movementRepo, ids);

    expect(movementRepo.created[0].amount.amount).toBe(45000);
  });

  it('blocks sale-born credits (owned by their sale, R5-D0c)', async () => {
    const credit = makeCredit({ saleId: 'sale-1' });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    await expect(
      writeOffCreditGranted('user-1', 'cg-1', creditRepo, movementRepo, ids),
    ).rejects.toThrow(ConflictError);

    expect(movementRepo.created).toHaveLength(0);
    expect(creditRepo.writtenOff).toHaveLength(0);
  });

  it('blocks a second write-off', async () => {
    const credit = makeCredit({ writtenOff: { date: new Date(), movementId: 'm-x' } });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    await expect(
      writeOffCreditGranted('user-1', 'cg-1', creditRepo, movementRepo, ids),
    ).rejects.toThrow(WRITE_OFF_ALREADY_MSG);

    expect(movementRepo.created).toHaveLength(0);
  });

  it('blocks a fully-paid credit', async () => {
    const credit = makeCredit({}, [
      { id: 'ab-1', amount: new Money(100000, 'COP'), date: new Date('2025-08-01'), accountId: 'acc-1', movementId: 'm-ab1', capitalAmount: new Money(100000, 'COP') },
    ]);
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    await expect(
      writeOffCreditGranted('user-1', 'cg-1', creditRepo, movementRepo, ids),
    ).rejects.toThrow(WRITE_OFF_PAID_MSG);

    expect(movementRepo.created).toHaveLength(0);
  });

  it('blocks write-off when the debtor returned ALL capital (no capital loss, interest pending)', async () => {
    const credit = makeCredit({ installments: 2, installmentValue: new Money(60000, 'COP') }, [
      { id: 'ab-1', amount: new Money(100000, 'COP'), date: new Date('2025-08-01'), accountId: 'acc-1', movementId: 'm-ab1', capitalAmount: new Money(100000, 'COP') },
      { id: 'ab-2', amount: new Money(10000, 'COP'), date: new Date('2025-09-01'), accountId: 'acc-1', movementId: 'm-ab2', interestAmount: new Money(10000, 'COP') },
    ]);
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    await expect(
      writeOffCreditGranted('user-1', 'cg-1', creditRepo, movementRepo, ids),
    ).rejects.toThrow(WRITE_OFF_NO_LOSS_MSG);

    expect(movementRepo.created).toHaveLength(0);
    expect(creditRepo.writtenOff).toHaveLength(0);
  });

  it('throws NotFoundError when credit does not exist', async () => {
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    await expect(
      writeOffCreditGranted('user-1', 'missing', creditRepo, movementRepo, ids),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── R9/D9.1 — markAsPaid final settlement splits ──────────────────

describe('markAsPaid — split on final settlement (R9)', () => {
  it('splits the pending settlement into capital recovery + interest', async () => {
    const credit = makeCredit({ installments: 2, installmentValue: new Money(65000, 'COP') });
    const creditRepo = fakeCreditRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const result = await markAsPaid('user-1', 'cg-1', creditRepo, movementRepo, ids, accountRepo);

    expect(result.pending).toBe(0);
    expect(creditRepo.abonosAdded).toHaveLength(1);
    expect(creditRepo.abonosAdded[0].abono.amount).toBe(130000);
    expect(creditRepo.abonosAdded[0].abono.capitalAmount).toBe(100000);
    expect(creditRepo.abonosAdded[0].abono.interestAmount).toBe(30000);
    expect(movementRepo.created).toHaveLength(2);
    expect(movementRepo.created[0].link?.kind).toBe('creditGrantedAbono');
    expect(movementRepo.created[0].amount.amount).toBe(100000);
    expect(movementRepo.created[1].link?.kind).toBe('creditGrantedAbonoInterest');
    expect(movementRepo.created[1].amount.amount).toBe(30000);
  });
});
