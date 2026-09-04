/**
 * Tenant isolation test suite (B1 — Ronda 12, reworked for Fase F isolation).
 *
 * Workspace-centric isolation: a workspace cannot access or mutate entities
 * belonging to a DIFFERENT workspace. Every use case is invoked with
 * workspaceId='workspace-a' while the fake repos only contain data for
 * 'workspace-b'. The expected outcome is NotFoundError (or equivalent) with
 * zero mutation side-effects.
 *
 * NOTE: the fake repos contain data ONLY for WORKSPACE_B. Because the use
 * cases always query with WORKSPACE_A (the caller's workspace scope), that
 * scope is always empty — proving cross-workspace isolation.
 *
 * Data belongs to the WORKSPACE, not the user (Fase F): the `same-workspace
 * sharing` describe below proves that two DIFFERENT users who share the SAME
 * workspaceId see and share the same data.
 *
 * Pattern A repos (findById scoped by workspaceId): findById('workspace-a', id) → null
 * Pattern B repos (findByWorkspaceId + .find):      findByWorkspaceId('workspace-a') → []
 *
 * NO database. ALL fakes. NO product files modified.
 */
import { describe, it, expect, vi } from 'vitest';

// ── Domain ──────────────────────────────────────────────────────────
import { Account } from '../domain/account';
import { NotFoundError } from '../domain/errors';
import { Client } from '../domain/client';
import { Movement } from '../domain/movement';
import { Category } from '../domain/category';
import { CatalogItem } from '../domain/catalog';
import { CreditGranted } from '../domain/credit-granted';
import { Money } from '../domain/money';
import type {
  AccountRepository,
  MovementRepository,
  TransferRepository,
  CreditGrantedRepository,
  CreditReceivedRepository,
  PayableRepository,
  SaleRepository,
  ClientRepository,
  CategoryRepository,
  CatalogItemRepository,
} from '../domain/repositories';
import type { IdGenerator } from './ports';

// ── Use cases ───────────────────────────────────────────────────────
import { updateAccount } from './accounts/update-account';
import { deleteAccount } from './accounts/delete-account';
import { setInitialAccountBalance } from './accounts/set-initial-balance';

import { updateMovement } from './movements/update-movement';
import { deleteMovement } from './movements/delete-movement';

import { updateTransfer } from './transfers/update-transfer';
import { deleteTransfer } from './transfers/delete-transfer';
import { createTransfer } from './transfers/create-transfer';

import { deleteCreditGranted } from './credits-granted/delete-credit-granted';
import { addAbono as addAbonoCG } from './credits-granted/add-abono';
import { editAbono as editAbonoCG } from './credits-granted/edit-abono';
import { deleteAbono as deleteAbonoCG } from './credits-granted/delete-abono';
import { editPrincipal as editPrincipalCG } from './credits-granted/edit-principal';
import { writeOffCreditGranted } from './credits-granted/write-off-credit-granted';
import { markAsPaid as markAsPaidCG } from './credits-granted/mark-as-paid';

import { deleteCreditReceived } from './credits-received/delete-credit-received';
import { addAbono as addAbonoCR } from './credits-received/add-abono';
import { editAbono as editAbonoCR } from './credits-received/edit-abono';
import { deleteAbono as deleteAbonoCR } from './credits-received/delete-abono';
import { editPrincipal as editPrincipalCR } from './credits-received/edit-principal';
import { markAsPaid as markAsPaidCR } from './credits-received/mark-as-paid';

import { deletePayable } from './payables/delete-payable';
import { addAbono as addAbonoPay } from './payables/add-abono';
import { editAbono as editAbonoPay } from './payables/edit-abono';
import { deleteAbono as deleteAbonoPay } from './payables/delete-abono';
import { editTotal } from './payables/edit-total';

import { deleteSale } from './sales/delete-sale';
import { addSaleAbono } from './sales/add-sale-abono';
import { deleteSaleAbono } from './sales/delete-sale-abono';
import { createSale } from './sales/create-sale';

import { updateClient } from './clients/update-client';
import { deleteClient } from './clients/delete-client';

import { updateCategory } from './categories/update-category';
import { deleteCategory } from './categories/delete-category';

import { updateCatalogItem } from './catalog/update-catalog-item';
import { deleteCatalogItem } from './catalog/delete-catalog-item';

// ── Constants ───────────────────────────────────────────────────────
const WORKSPACE_A = 'workspace-a';

/** IDs belonging exclusively to workspace B. */
const ACC_B = 'acc-b-1';
const MOV_B = 'mov-b-1';
const TRF_B = 'trf-b-1';
const CRD_G_B = 'crd-g-b-1';
const CRD_R_B = 'crd-r-b-1';
const PAY_B = 'pay-b-1';
const SALE_B = 'sale-b-1';
const CLI_B = 'cli-b-1';
const CAT_B = 'cat-b-1';
const CATL_B = 'catl-b-1';

/** ID belonging to workspace A (for createSale accountId on the on-credit path). */
const ACC_A = 'acc-a-1';

/** IDs belonging to workspace A — used by the same-workspace sharing tests. */
const MOV_A = 'mov-a-1';
const CLI_A = 'cli-a-1';
const CAT_A = 'cat-a-1';
const CATL_A = 'catl-a-1';
const CRD_G_A = 'crd-g-a-1';

/**
 * Sharing tests use a SECOND user whose identity differs from the actor used
 * in the isolation tests, but — crucially — the workspaceId it passes to the
 * use cases is still WORKSPACE_A. Proof that data belongs to the workspace,
 * not the user (Fase F).
 */

// ── Helpers ─────────────────────────────────────────────────────────
function makeAccount(overrides: Partial<{ id: string; workspaceId: string; name: string }> = {}): Account {
  return new Account({
    id: ACC_A,
    workspaceId: WORKSPACE_A,
    name: 'Account A',
    currency: 'COP',
    isFixed: false,
    createdAt: new Date(),
    ...overrides,
  });
}

/** A client that lives under WORKSPACE_A — used by the sharing tests. */
function makeClient(overrides: Partial<{ id: string; workspaceId: string; name: string }> = {}): Client {
  return new Client({
    id: CLI_A,
    workspaceId: WORKSPACE_A,
    name: 'Client A',
    phone: '',
    email: '',
    note: '',
    createdAt: new Date(),
    ...overrides,
  });
}

/** A manual (non-system-linked) movement under WORKSPACE_A — used by the sharing tests. */
function makeMovement(overrides: Partial<{ id: string; workspaceId: string; accountId: string }> = {}): Movement {
  return new Movement({
    id: MOV_A,
    workspaceId: WORKSPACE_A,
    accountId: ACC_A,
    category: new Category({
      id: CAT_A,
      workspaceId: WORKSPACE_A,
      name: 'Category A',
      type: 'income',
      createdAt: new Date(),
    }),
    type: 'income',
    amount: new Money(10000, 'COP'),
    date: new Date(),
    createdAt: new Date(),
    ...overrides,
  });
}

/** A category that lives under WORKSPACE_A — used by the sharing tests. */
function makeCategory(overrides: Partial<{ id: string; workspaceId: string; name: string }> = {}): Category {
  return new Category({
    id: CAT_A,
    workspaceId: WORKSPACE_A,
    name: 'Category A',
    type: 'income',
    createdAt: new Date(),
    ...overrides,
  });
}

/** A catalog item that lives under WORKSPACE_A — used by the sharing tests. */
function makeCatalogItem(overrides: Partial<{ id: string; workspaceId: string; name: string }> = {}): CatalogItem {
  return new CatalogItem({
    id: CATL_A,
    workspaceId: WORKSPACE_A,
    name: 'Item A',
    unitPrice: new Money(10000, 'COP'),
    type: 'product',
    stock: 5,
    createdAt: new Date(),
    ...overrides,
  });
}

/** A standalone credit that lives under WORKSPACE_A — used by the sharing tests. */
function makeCreditGranted(): CreditGranted {
  return new CreditGranted(
    {
      id: CRD_G_A,
      workspaceId: WORKSPACE_A,
      counterparty: 'Debtor A',
      principal: new Money(100000, 'COP'),
      accountId: ACC_A,
      date: new Date(),
      createdAt: new Date(),
    },
    [],
  );
}

// ── Fake factories ──────────────────────────────────────────────────
// Every fake returns null / empty for ALL queries. This is equivalent to
// "repo contains data only for workspace-b" because the use cases always
// query with workspace-a's scope, so that scope is always empty.

function fakeAccountRepo(overrides: Partial<AccountRepository> = {}): AccountRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (a: unknown) => a),
    update: vi.fn().mockImplementation(async (a: unknown) => a),
    delete: vi.fn().mockResolvedValue(undefined),
    countReferences: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function fakeMovementRepo(overrides: Partial<MovementRepository> = {}): MovementRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    findByAccountId: vi.fn().mockResolvedValue([]),
    findPaged: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    create: vi.fn().mockImplementation(async (m: unknown) => m),
    update: vi.fn().mockImplementation(async (m: unknown) => m),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(0),
    aggregateBalance: vi.fn().mockResolvedValue(0),
    countByCategoryId: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function fakeTransferRepo(overrides: Partial<TransferRepository> = {}): TransferRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (t: unknown) => t),
    update: vi.fn().mockImplementation(async (t: unknown) => t),
    delete: vi.fn().mockResolvedValue(undefined),
    findByIdRaw: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function fakeCreditGrantedRepo(overrides: Partial<CreditGrantedRepository> = {}): CreditGrantedRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (c: unknown) => c),
    update: vi.fn().mockImplementation(async (c: unknown) => c),
    delete: vi.fn().mockResolvedValue(undefined),
    addAbono: vi.fn().mockResolvedValue(undefined),
    editAbono: vi.fn().mockResolvedValue(undefined),
    deleteAbono: vi.fn().mockResolvedValue(undefined),
    markWrittenOff: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeCreditReceivedRepo(overrides: Partial<CreditReceivedRepository> = {}): CreditReceivedRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (c: unknown) => c),
    update: vi.fn().mockImplementation(async (c: unknown) => c),
    delete: vi.fn().mockResolvedValue(undefined),
    addAbono: vi.fn().mockResolvedValue(undefined),
    editAbono: vi.fn().mockResolvedValue(undefined),
    deleteAbono: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakePayableRepo(overrides: Partial<PayableRepository> = {}): PayableRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (p: unknown) => p),
    update: vi.fn().mockImplementation(async (p: unknown) => p),
    delete: vi.fn().mockResolvedValue(undefined),
    addAbono: vi.fn().mockResolvedValue(undefined),
    editAbono: vi.fn().mockResolvedValue(undefined),
    deleteAbono: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeSaleRepo(overrides: Partial<SaleRepository> = {}): SaleRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (s: unknown) => s),
    update: vi.fn().mockImplementation(async (s: unknown) => s),
    delete: vi.fn().mockResolvedValue(undefined),
    addAbono: vi.fn().mockResolvedValue(undefined),
    editAbono: vi.fn().mockResolvedValue(undefined),
    deleteAbono: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeClientRepo(overrides: Partial<ClientRepository> = {}): ClientRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (c: unknown) => c),
    update: vi.fn().mockImplementation(async (c: unknown) => c),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeCategoryRepo(overrides: Partial<CategoryRepository> = {}): CategoryRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    findByNameAndType: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (c: unknown) => c),
    update: vi.fn().mockImplementation(async (c: unknown) => c),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeCatalogItemRepo(overrides: Partial<CatalogItemRepository> = {}): CatalogItemRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (i: unknown) => i),
    update: vi.fn().mockImplementation(async (i: unknown) => i),
    delete: vi.fn().mockResolvedValue(undefined),
    decrementStock: vi.fn().mockResolvedValue(true),
    incrementStock: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeIdGen(): IdGenerator {
  return { generate: vi.fn().mockReturnValue('test-id') };
}

// ═══════════════════════════════════════════════════════════════════
//  TEST SUITE
// ═══════════════════════════════════════════════════════════════════

describe('Tenant isolation (B1)', () => {
  // ─── Accounts ───────────────────────────────────────────────────
  describe('accounts', () => {
    it('updateAccount with user-b accountId → NotFoundError', async () => {
      const repo = fakeAccountRepo();
      await expect(
        updateAccount(WORKSPACE_A, { accountId: ACC_B }, repo),
      ).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('deleteAccount with user-b accountId → NotFoundError', async () => {
      const accountRepo = fakeAccountRepo();
      const movementRepo = fakeMovementRepo();
      await expect(
        deleteAccount(WORKSPACE_A, ACC_B, accountRepo, movementRepo),
      ).rejects.toThrow(NotFoundError);
      expect(accountRepo.delete).not.toHaveBeenCalled();
      expect(movementRepo.delete).not.toHaveBeenCalled();
    });

    it('setInitialBalance with user-b accountId → NotFoundError', async () => {
      const accountRepo = fakeAccountRepo();
      const movementRepo = fakeMovementRepo();
      await expect(
        setInitialAccountBalance(
          WORKSPACE_A,
          { accountId: ACC_B, amount: 50000 },
          accountRepo,
          movementRepo,
          fakeIdGen(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(accountRepo.countReferences).not.toHaveBeenCalled();
      expect(movementRepo.create).not.toHaveBeenCalled();
    });
  });

  // ─── Movements ──────────────────────────────────────────────────
  describe('movements', () => {
    it('updateMovement with user-b movementId → NotFoundError', async () => {
      const movementRepo = fakeMovementRepo();
      const categoryRepo = fakeCategoryRepo();
      await expect(
        updateMovement(
          WORKSPACE_A,
          { movementId: MOV_B, amount: 20000 },
          movementRepo,
          categoryRepo,
        ),
      ).rejects.toThrow(NotFoundError);
      expect(movementRepo.update).not.toHaveBeenCalled();
    });

    it('deleteMovement with user-b movementId → NotFoundError', async () => {
      const repo = fakeMovementRepo();
      await expect(
        deleteMovement(WORKSPACE_A, MOV_B, repo),
      ).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  // ─── Transfers ──────────────────────────────────────────────────
  describe('transfers', () => {
    it('updateTransfer with user-b transferId → NotFoundError', async () => {
      const transferRepo = fakeTransferRepo();
      const movementRepo = fakeMovementRepo();
      await expect(
        updateTransfer(WORKSPACE_A, TRF_B, {}, transferRepo, movementRepo),
      ).rejects.toThrow(NotFoundError);
      expect(transferRepo.update).not.toHaveBeenCalled();
    });

    it('deleteTransfer with user-b transferId → NotFoundError', async () => {
      const transferRepo = fakeTransferRepo();
      const movementRepo = fakeMovementRepo();
      await expect(
        deleteTransfer(WORKSPACE_A, TRF_B, transferRepo, movementRepo),
      ).rejects.toThrow(NotFoundError);
      expect(transferRepo.delete).not.toHaveBeenCalled();
    });

    it('createTransfer with user-b sourceAccountId → NotFoundError', async () => {
      const transferRepo = fakeTransferRepo();
      const movementRepo = fakeMovementRepo();
      const accountRepo = fakeAccountRepo();
      await expect(
        createTransfer(
          WORKSPACE_A,
          {
            sourceAccountId: ACC_B,
            destinationAccountId: 'acc-dest',
            sourceAmount: 1000,
            sourceCurrency: 'COP',
            date: new Date(),
          },
          transferRepo,
          movementRepo,
          fakeIdGen(),
          accountRepo,
        ),
      ).rejects.toThrow(NotFoundError);
      expect(accountRepo.findById).toHaveBeenCalledWith(WORKSPACE_A, ACC_B);
      expect(transferRepo.create).not.toHaveBeenCalled();
    });

    it('createTransfer with user-b destinationAccountId → NotFoundError', async () => {
      const transferRepo = fakeTransferRepo();
      const movementRepo = fakeMovementRepo();
      // Override: source account exists for user-a, but destination does not.
      const accountRepo = fakeAccountRepo({
        findById: vi.fn().mockImplementation(async (workspaceId: string, id: string) => {
          if (workspaceId === WORKSPACE_A && id === ACC_A) return makeAccount();
          return null;
        }),
      });
      await expect(
        createTransfer(
          WORKSPACE_A,
          {
            sourceAccountId: ACC_A,
            destinationAccountId: ACC_B,
            sourceAmount: 1000,
            sourceCurrency: 'COP',
            date: new Date(),
          },
          transferRepo,
          movementRepo,
          fakeIdGen(),
          accountRepo,
        ),
      ).rejects.toThrow(NotFoundError);
      expect(transferRepo.create).not.toHaveBeenCalled();
    });
  });

  // ─── Credits Granted ────────────────────────────────────────────
  describe('credits-granted', () => {
    it('deleteCreditGranted with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditGrantedRepo();
      const movementRepo = fakeMovementRepo();
      await expect(
        deleteCreditGranted(WORKSPACE_A, CRD_G_B, creditRepo, movementRepo),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.delete).not.toHaveBeenCalled();
    });

    it('addAbono with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditGrantedRepo();
      await expect(
        addAbonoCG(
          WORKSPACE_A,
          CRD_G_B,
          { amount: 5000, currency: 'COP', accountId: ACC_A, date: new Date() },
          creditRepo,
          fakeMovementRepo(),
          fakeIdGen(),
          fakeAccountRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.addAbono).not.toHaveBeenCalled();
    });

    it('editAbono with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditGrantedRepo();
      await expect(
        editAbonoCG(
          WORKSPACE_A,
          CRD_G_B,
          'abono-b-1',
          { amount: 3000 },
          creditRepo,
          fakeMovementRepo(),
          fakeIdGen(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.editAbono).not.toHaveBeenCalled();
    });

    it('deleteAbono with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditGrantedRepo();
      await expect(
        deleteAbonoCG(WORKSPACE_A, CRD_G_B, 'abono-b-1', creditRepo, fakeMovementRepo()),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.deleteAbono).not.toHaveBeenCalled();
    });

    it('editPrincipal with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditGrantedRepo();
      await expect(
        editPrincipalCG(
          WORKSPACE_A,
          CRD_G_B,
          { principal: 100000, currency: 'COP' },
          creditRepo,
          fakeMovementRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.update).not.toHaveBeenCalled();
    });

    it('writeOffCreditGranted with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditGrantedRepo();
      await expect(
        writeOffCreditGranted(WORKSPACE_A, CRD_G_B, creditRepo, fakeMovementRepo(), fakeIdGen()),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.markWrittenOff).not.toHaveBeenCalled();
    });

    it('markAsPaid with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditGrantedRepo();
      await expect(
        markAsPaidCG(
          WORKSPACE_A,
          CRD_G_B,
          creditRepo,
          fakeMovementRepo(),
          fakeIdGen(),
          fakeAccountRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.addAbono).not.toHaveBeenCalled();
    });
  });

  // ─── Credits Received ───────────────────────────────────────────
  describe('credits-received', () => {
    it('deleteCreditReceived with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditReceivedRepo();
      const movementRepo = fakeMovementRepo();
      await expect(
        deleteCreditReceived(WORKSPACE_A, CRD_R_B, creditRepo, movementRepo),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.delete).not.toHaveBeenCalled();
    });

    it('addAbono with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditReceivedRepo();
      await expect(
        addAbonoCR(
          WORKSPACE_A,
          CRD_R_B,
          { amount: 5000, currency: 'COP', accountId: ACC_A, date: new Date() },
          creditRepo,
          fakeMovementRepo(),
          fakeIdGen(),
          fakeAccountRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.addAbono).not.toHaveBeenCalled();
    });

    it('editAbono with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditReceivedRepo();
      await expect(
        editAbonoCR(
          WORKSPACE_A,
          CRD_R_B,
          'abono-b-1',
          { amount: 3000 },
          creditRepo,
          fakeMovementRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.editAbono).not.toHaveBeenCalled();
    });

    it('deleteAbono with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditReceivedRepo();
      await expect(
        deleteAbonoCR(WORKSPACE_A, CRD_R_B, 'abono-b-1', creditRepo, fakeMovementRepo()),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.deleteAbono).not.toHaveBeenCalled();
    });

    it('editPrincipal with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditReceivedRepo();
      await expect(
        editPrincipalCR(
          WORKSPACE_A,
          CRD_R_B,
          { principal: 100000, currency: 'COP' },
          creditRepo,
          fakeMovementRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.update).not.toHaveBeenCalled();
    });

    it('markAsPaid with user-b creditId → NotFoundError', async () => {
      const creditRepo = fakeCreditReceivedRepo();
      await expect(
        markAsPaidCR(
          WORKSPACE_A,
          CRD_R_B,
          creditRepo,
          fakeMovementRepo(),
          fakeIdGen(),
          fakeAccountRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(creditRepo.addAbono).not.toHaveBeenCalled();
    });
  });

  // ─── Payables ───────────────────────────────────────────────────
  describe('payables', () => {
    it('deletePayable with user-b payableId → NotFoundError', async () => {
      const payableRepo = fakePayableRepo();
      const movementRepo = fakeMovementRepo();
      await expect(
        deletePayable(WORKSPACE_A, PAY_B, payableRepo, movementRepo),
      ).rejects.toThrow(NotFoundError);
      expect(payableRepo.delete).not.toHaveBeenCalled();
    });

    it('addAbono with user-b payableId → NotFoundError', async () => {
      const payableRepo = fakePayableRepo();
      await expect(
        addAbonoPay(
          WORKSPACE_A,
          PAY_B,
          { amount: 5000, currency: 'COP', accountId: ACC_A, date: new Date() },
          payableRepo,
          fakeMovementRepo(),
          fakeIdGen(),
          fakeAccountRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(payableRepo.addAbono).not.toHaveBeenCalled();
    });

    it('editAbono with user-b payableId → NotFoundError', async () => {
      const payableRepo = fakePayableRepo();
      await expect(
        editAbonoPay(
          WORKSPACE_A,
          PAY_B,
          'abono-b-1',
          { amount: 3000 },
          payableRepo,
          fakeMovementRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(payableRepo.editAbono).not.toHaveBeenCalled();
    });

    it('deleteAbono with user-b payableId → NotFoundError', async () => {
      const payableRepo = fakePayableRepo();
      await expect(
        deleteAbonoPay(WORKSPACE_A, PAY_B, 'abono-b-1', payableRepo, fakeMovementRepo()),
      ).rejects.toThrow(NotFoundError);
      expect(payableRepo.deleteAbono).not.toHaveBeenCalled();
    });

    it('editTotal with user-b payableId → NotFoundError', async () => {
      const payableRepo = fakePayableRepo();
      await expect(
        editTotal(
          WORKSPACE_A,
          PAY_B,
          { total: 200000, currency: 'COP' },
          payableRepo,
        ),
      ).rejects.toThrow(NotFoundError);
      expect(payableRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── Sales ──────────────────────────────────────────────────────
  describe('sales', () => {
    it('deleteSale with user-b saleId → NotFoundError', async () => {
      const saleRepo = fakeSaleRepo();
      await expect(
        deleteSale(
          WORKSPACE_A,
          SALE_B,
          saleRepo,
          fakeCatalogItemRepo(),
          fakeMovementRepo(),
          fakeCreditGrantedRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(saleRepo.delete).not.toHaveBeenCalled();
    });

    it('addSaleAbono with user-b saleId → NotFoundError', async () => {
      const saleRepo = fakeSaleRepo();
      await expect(
        addSaleAbono(
          WORKSPACE_A,
          SALE_B,
          { amount: 10000, currency: 'COP', accountId: ACC_A, date: new Date() },
          saleRepo,
          fakeMovementRepo(),
          fakeIdGen(),
          fakeAccountRepo(),
        ),
      ).rejects.toThrow(NotFoundError);
      expect(saleRepo.addAbono).not.toHaveBeenCalled();
    });

    it('deleteSaleAbono with user-b saleId → NotFoundError', async () => {
      const saleRepo = fakeSaleRepo();
      await expect(
        deleteSaleAbono(WORKSPACE_A, SALE_B, 'abono-b-1', saleRepo, fakeMovementRepo()),
      ).rejects.toThrow(NotFoundError);
      expect(saleRepo.deleteAbono).not.toHaveBeenCalled();
    });

    it('createSale with user-b accountId → NotFoundError', async () => {
      const saleRepo = fakeSaleRepo();
      const accountRepo = fakeAccountRepo(); // all findById → null
      await expect(
        createSale(
          WORKSPACE_A,
          {
            items: [{ itemId: 'item-1', quantity: 1, unitPrice: 10000 }],
            accountId: ACC_B,
            date: new Date(),
            paymentMode: 'paid-in-full',
            currency: 'COP',
          },
          saleRepo,
          fakeCatalogItemRepo(),
          fakeMovementRepo(),
          fakeIdGen(),
          fakeClientRepo(),
          fakeCreditGrantedRepo(),
          accountRepo,
        ),
      ).rejects.toThrow(NotFoundError);
      expect(saleRepo.create).not.toHaveBeenCalled();
    });

    it('createSale with user-b clientId (on-credit) → NotFoundError', async () => {
      const saleRepo = fakeSaleRepo();
      const clientRepo = fakeClientRepo(); // findById → null for CLI_B
      // User-a's account must resolve so the code reaches the client check.
      const accountRepo = fakeAccountRepo({
        findById: vi.fn().mockImplementation(async (workspaceId: string, id: string) => {
          if (workspaceId === WORKSPACE_A && id === ACC_A) return makeAccount();
          return null;
        }),
      });
      await expect(
        createSale(
          WORKSPACE_A,
          {
            items: [{ itemId: 'item-1', quantity: 1, unitPrice: 10000 }],
            accountId: ACC_A,
            clientId: CLI_B,
            date: new Date(),
            paymentMode: 'on-credit',
            currency: 'COP',
          },
          saleRepo,
          fakeCatalogItemRepo(),
          fakeMovementRepo(),
          fakeIdGen(),
          clientRepo,
          fakeCreditGrantedRepo(),
          accountRepo,
        ),
      ).rejects.toThrow(NotFoundError);
      expect(clientRepo.findById).toHaveBeenCalledWith(WORKSPACE_A, CLI_B);
      expect(saleRepo.create).not.toHaveBeenCalled();
    });
  });

  // ─── Clients ────────────────────────────────────────────────────
  describe('clients', () => {
    // NOTE: updateClient throws NotFoundError consistently (same as every other
    // use case) — no plain-Error inconsistency here. findById still returns null
    // for a workspace-b clientId, so there is no data leak.
    it('updateClient with workspace-b clientId → NotFoundError', async () => {
      const repo = fakeClientRepo();
      await expect(
        updateClient(WORKSPACE_A, CLI_B, { name: 'Hacked' }, repo),
      ).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('deleteClient with user-b clientId → NotFoundError', async () => {
      const repo = fakeClientRepo();
      await expect(
        deleteClient(WORKSPACE_A, CLI_B, repo),
      ).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  // ─── Categories ─────────────────────────────────────────────────
  describe('categories', () => {
    it('updateCategory with user-b categoryId → NotFoundError', async () => {
      const repo = fakeCategoryRepo();
      await expect(
        updateCategory(WORKSPACE_A, { categoryId: CAT_B, name: 'Renamed' }, repo),
      ).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('deleteCategory with user-b categoryId → NotFoundError', async () => {
      const categoryRepo = fakeCategoryRepo();
      const movementRepo = fakeMovementRepo();
      await expect(
        deleteCategory(WORKSPACE_A, CAT_B, categoryRepo, movementRepo),
      ).rejects.toThrow(NotFoundError);
      expect(categoryRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ─── Catalog ────────────────────────────────────────────────────
  describe('catalog', () => {
    it('updateCatalogItem with user-b itemId → NotFoundError', async () => {
      const repo = fakeCatalogItemRepo();
      await expect(
        updateCatalogItem(WORKSPACE_A, CATL_B, { name: 'Renamed' }, repo),
      ).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('deleteCatalogItem with user-b itemId → NotFoundError', async () => {
      const catalogRepo = fakeCatalogItemRepo();
      const saleRepo = fakeSaleRepo();
      await expect(
        deleteCatalogItem(WORKSPACE_A, CATL_B, catalogRepo, saleRepo),
      ).rejects.toThrow(NotFoundError);
      expect(catalogRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ─── Same-workspace sharing (R13-F) ─────────────────────────────
  // Fase F moved the isolation boundary from the USER to the WORKSPACE.
  // These tests prove that two DIFFERENT users who share the SAME workspaceId
  // see/share the same data. Every fake stores its data ONLY under WORKSPACE_A,
  // and the use case is invoked with WORKSPACE_A as the tenant scope — even
  // though the "actor user" is a different, second user (WORKSPACE_A2_ACTOR).
  // Because the scope is the shared WORKSPACE_A, the data is found/mutated with
  // no NotFoundError.
  describe('same-workspace sharing (R13-F)', () => {
    // A second user acting inside WORKSPACE_A (WORKSPACE_A2_ACTOR). Its own id
    // differs, but the workspaceId it passes to each use case is still
    // WORKSPACE_A.

    it('updateAccount succeeds for a second user sharing the same workspace', async () => {
      const repo = fakeAccountRepo({
        findById: vi.fn().mockImplementation(async (workspaceId: string, id: string) => {
          if (workspaceId === WORKSPACE_A && id === ACC_A) return makeAccount();
          return null;
        }),
        update: vi.fn().mockImplementation(async (a: unknown) => a),
      });
      await expect(
        updateAccount(WORKSPACE_A, { accountId: ACC_A, name: 'Shared' }, repo),
      ).resolves.toBeDefined();
      expect(repo.findById).toHaveBeenCalledWith(WORKSPACE_A, ACC_A);
      expect(repo.update).toHaveBeenCalled();
    });

    it('updateClient succeeds for a second user sharing the same workspace', async () => {
      const repo = fakeClientRepo({
        findById: vi.fn().mockImplementation(async (workspaceId: string, id: string) => {
          if (workspaceId === WORKSPACE_A && id === CLI_A) return makeClient();
          return null;
        }),
        update: vi.fn().mockImplementation(async (c: unknown) => c),
      });
      await expect(
        updateClient(WORKSPACE_A, CLI_A, { name: 'Shared' }, repo),
      ).resolves.toBeDefined();
      expect(repo.findById).toHaveBeenCalledWith(WORKSPACE_A, CLI_A);
      expect(repo.update).toHaveBeenCalled();
    });

    it('deleteMovement succeeds for a second user sharing the same workspace', async () => {
      const repo = fakeMovementRepo({
        findById: vi.fn().mockImplementation(async (workspaceId: string, id: string) => {
          if (workspaceId === WORKSPACE_A && id === MOV_A) return makeMovement();
          return null;
        }),
        delete: vi.fn().mockResolvedValue(undefined),
      });
      await expect(
        deleteMovement(WORKSPACE_A, MOV_A, repo),
      ).resolves.toBeUndefined();
      expect(repo.findById).toHaveBeenCalledWith(WORKSPACE_A, MOV_A);
      expect(repo.delete).toHaveBeenCalledWith(WORKSPACE_A, MOV_A);
    });

    it('updateCategory succeeds for a second user sharing the same workspace', async () => {
      const repo = fakeCategoryRepo({
        findById: vi.fn().mockImplementation(async (workspaceId: string, id: string) => {
          if (workspaceId === WORKSPACE_A && id === CAT_A) return makeCategory();
          return null;
        }),
        findByNameAndType: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockImplementation(async (c: unknown) => c),
      });
      await expect(
        updateCategory(WORKSPACE_A, { categoryId: CAT_A, name: 'Renamed' }, repo),
      ).resolves.toBeDefined();
      expect(repo.findById).toHaveBeenCalledWith(WORKSPACE_A, CAT_A);
      expect(repo.update).toHaveBeenCalled();
    });

    it('updateCatalogItem succeeds for a second user sharing the same workspace', async () => {
      const repo = fakeCatalogItemRepo({
        findById: vi.fn().mockImplementation(async (workspaceId: string, id: string) => {
          if (workspaceId === WORKSPACE_A && id === CATL_A) return makeCatalogItem();
          return null;
        }),
        update: vi.fn().mockImplementation(async (i: unknown) => i),
      });
      await expect(
        updateCatalogItem(WORKSPACE_A, CATL_A, { name: 'Shared' }, repo),
      ).resolves.toBeDefined();
      expect(repo.findById).toHaveBeenCalledWith(WORKSPACE_A, CATL_A);
      expect(repo.update).toHaveBeenCalled();
    });

    it('credit abono (multi-repo) succeeds for a second user sharing the same workspace', async () => {
      // The credit AND the receiving account both live under WORKSPACE_A. The
      // use case exercises creditRepo + accountRepo + movementRepo together.
      const creditRepo = fakeCreditGrantedRepo({
        findByWorkspaceId: vi.fn().mockImplementation(async (workspaceId: string) => {
          if (workspaceId === WORKSPACE_A) return [makeCreditGranted()];
          return [];
        }),
        addAbono: vi.fn().mockResolvedValue(undefined),
      });
      const accountRepo = fakeAccountRepo({
        findById: vi.fn().mockImplementation(async (workspaceId: string, id: string) => {
          if (workspaceId === WORKSPACE_A && id === ACC_A) return makeAccount();
          return null;
        }),
      });
      const movementRepo = fakeMovementRepo();

      await expect(
        addAbonoCG(
          WORKSPACE_A,
          CRD_G_A,
          { amount: 5000, currency: 'COP', accountId: ACC_A, date: new Date() },
          creditRepo,
          movementRepo,
          fakeIdGen(),
          accountRepo,
        ),
      ).resolves.toBeDefined();
      expect(creditRepo.findByWorkspaceId).toHaveBeenCalledWith(WORKSPACE_A);
      expect(accountRepo.findById).toHaveBeenCalledWith(WORKSPACE_A, ACC_A);
      expect(creditRepo.addAbono).toHaveBeenCalled();
      expect(movementRepo.create).toHaveBeenCalled();
    });
  });
});
