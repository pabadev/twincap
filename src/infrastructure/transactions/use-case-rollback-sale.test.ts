import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createSale } from '../../core/application/sales/create-sale';
import { MongoSaleRepository } from '../repositories/sale-repository';
import { MongoCatalogItemRepository } from '../repositories/catalog-repository';
import { MongoMovementRepository } from '../repositories/movement-repository';
import { MongoClientRepository } from '../repositories/client-repository';
import { MongoCreditGrantedRepository } from '../repositories/credit-granted-repository';
import { MongoAccountRepository } from '../repositories/account-repository';
import { objectIdGenerator } from '../config/id-generator';
import { MongoUnitOfWork } from './mongo-unit-of-work';
import { AccountModel } from '../models/account';
import { SaleModel } from '../models/sale';
import { CatalogItemModel } from '../models/catalog';
import { MovementModel } from '../models/movement';
import { CreditGrantedModel } from '../models/credit-granted';
import { ClientModel } from '../models/client';

/**
 * R15.2 §38 — createSale REAL multi-document transaction: rollback across
 * EVERY write phase against a shared single-node MongoMemoryReplSet.
 *
 * Write order inside the transaction (create-sale.ts):
 *   1. accountRepo.touch        — shared-document write (delete-race guard)
 *   2. catalogRepo.decrementStock — atomic $inc guard (physical items)
 *   3. saleRepo.create
 *   4. creditRepo.create         — on-credit only
 *   5. movementRepo.create       — paid-in-full: salePayment; on-credit + >0
 *                                  initial payment: FIRST abono
 *
 * Fail-injection spies force each step to blow up. Because everything runs in
 * ONE transaction, every case must leave ZERO persisted evidence: no sale, no
 * credit, no movement, stock untouched and the account document untouched.
 *
 * BINARY PIN (R15-F2, regla permanente): mongod DEBE pinarse a 7.0.41 (latest
 * crashea en Windows). Mismo pin que la suite Fase 2 use-case-rollback.
 */
describe('R15.2 §38 — createSale real rollback across every write phase', () => {
  let mongod: MongoMemoryReplSet;

  const WS = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const ACCOUNT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const CATALOG_ID = 'cccccccccccccccccccccccc';
  const CLIENT_ID = 'dddddddddddddddddddddddd';

  const UOW = new MongoUnitOfWork();
  const IDS = objectIdGenerator;
  const DATE = new Date('2025-06-01');

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: '7.0.41' },
      replSet: { count: 1, name: 'rs0' },
    });
    await mongoose.connect(mongod.getUri('twincap_38'));
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await AccountModel.deleteMany({});
    await SaleModel.deleteMany({});
    await CatalogItemModel.deleteMany({});
    await MovementModel.deleteMany({});
    await CreditGrantedModel.deleteMany({});
    await ClientModel.deleteMany({});
    await AccountModel.create({
      _id: ACCOUNT_ID,
      workspaceId: WS,
      name: 'Cash',
      currency: 'COP',
      isFixed: false,
    });
    await CatalogItemModel.create({
      _id: CATALOG_ID,
      workspaceId: WS,
      name: 'Pan',
      unitPrice: 10000,
      currency: 'COP',
      type: 'product',
      stock: 5,
    });
    await ClientModel.create({
      _id: CLIENT_ID,
      workspaceId: WS,
      name: 'Juan Pérez',
    });
  });

  async function expectNothingPersisted() {
    expect(await SaleModel.countDocuments({ workspaceId: WS })).toBe(0);
    expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(0);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
    const item = await CatalogItemModel.findById(CATALOG_ID);
    expect(item!.stock).toBe(5); // no decrement survived the rollback
    expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(1);
  }

  function onCreditInput(initialPayment: number) {
    return {
      items: [{ itemId: CATALOG_ID, quantity: 1, unitPrice: 10000 }],
      accountId: ACCOUNT_ID,
      clientId: CLIENT_ID,
      date: DATE,
      paymentMode: 'on-credit' as const,
      currency: 'COP' as const,
      initialPayment,
    };
  }

  function run(
    input: ReturnType<typeof onCreditInput>,
    saleRepo: MongoSaleRepository,
    catalogRepo: MongoCatalogItemRepository,
    movementRepo: MongoMovementRepository,
    clientRepo: MongoClientRepository,
    creditRepo: MongoCreditGrantedRepository,
    accountRepo: MongoAccountRepository,
  ) {
    return createSale(
      WS,
      input,
      saleRepo,
      catalogRepo,
      movementRepo,
      IDS,
      clientRepo,
      creditRepo,
      accountRepo,
      UOW,
    );
  }

  it('fails on the account touch → nothing persisted', async () => {
    const accountRepo = new MongoAccountRepository();
    vi.spyOn(accountRepo, 'touch').mockImplementationOnce(async () => {
      throw new Error('boom: touch');
    });

    await expect(
      run(onCreditInput(2000), new MongoSaleRepository(), new MongoCatalogItemRepository(),
        new MongoMovementRepository(), new MongoClientRepository(),
        new MongoCreditGrantedRepository(), accountRepo),
    ).rejects.toThrow('boom: touch');

    await expectNothingPersisted();
  });

  it('fails on the stock decrement → nothing persisted, stock intact', async () => {
    const catalogRepo = new MongoCatalogItemRepository();
    vi.spyOn(catalogRepo, 'decrementStock').mockImplementationOnce(async () => {
      throw new Error('boom: decrement');
    });

    await expect(
      run(onCreditInput(2000), new MongoSaleRepository(), catalogRepo,
        new MongoMovementRepository(), new MongoClientRepository(),
        new MongoCreditGrantedRepository(), new MongoAccountRepository()),
    ).rejects.toThrow('boom: decrement');

    await expectNothingPersisted();
  });

  it('fails after the sale create (on the movement) → nothing persisted', async () => {
    const movementRepo = new MongoMovementRepository();
    vi.spyOn(movementRepo, 'create').mockImplementationOnce(async () => {
      throw new Error('boom: movement');
    });

    await expect(
      run(onCreditInput(2000), new MongoSaleRepository(), new MongoCatalogItemRepository(),
        movementRepo, new MongoClientRepository(),
        new MongoCreditGrantedRepository(), new MongoAccountRepository()),
    ).rejects.toThrow('boom: movement');

    await expectNothingPersisted();
  });

  it('fails after the sale create (on the credit) → nothing persisted, abono never written', async () => {
    const creditRepo = new MongoCreditGrantedRepository();
    vi.spyOn(creditRepo, 'create').mockImplementationOnce(async () => {
      throw new Error('boom: credit');
    });

    await expect(
      run(onCreditInput(2000), new MongoSaleRepository(), new MongoCatalogItemRepository(),
        new MongoMovementRepository(), new MongoClientRepository(), creditRepo,
        new MongoAccountRepository()),
    ).rejects.toThrow('boom: credit');

    await expectNothingPersisted();
  });

  it('fails on the FIRST abono movement (on-credit, initial payment > 0) → nothing persisted', async () => {
    const movementRepo = new MongoMovementRepository();
    vi.spyOn(movementRepo, 'create').mockImplementationOnce(async () => {
      throw new Error('boom: abono');
    });

    await expect(
      run(onCreditInput(2000), new MongoSaleRepository(), new MongoCatalogItemRepository(),
        movementRepo, new MongoClientRepository(),
        new MongoCreditGrantedRepository(), new MongoAccountRepository()),
    ).rejects.toThrow('boom: abono');

    await expectNothingPersisted();
  });

  it('paid-in-full: fails on the salePayment movement → nothing persisted', async () => {
    const movementRepo = new MongoMovementRepository();
    vi.spyOn(movementRepo, 'create').mockImplementationOnce(async () => {
      throw new Error('boom: salePayment');
    });

    await expect(
      createSale(
        WS,
        {
          items: [{ itemId: CATALOG_ID, quantity: 1, unitPrice: 10000 }],
          accountId: ACCOUNT_ID,
          date: DATE,
          paymentMode: 'paid-in-full',
          currency: 'COP',
        },
        new MongoSaleRepository(),
        new MongoCatalogItemRepository(),
        movementRepo,
        IDS,
        new MongoClientRepository(),
        new MongoCreditGrantedRepository(),
        new MongoAccountRepository(),
        UOW,
      ),
    ).rejects.toThrow('boom: salePayment');

    // paid-in-full writes no credit: same zero-evidence contract.
    expect(await SaleModel.countDocuments({ workspaceId: WS })).toBe(0);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
    const item = await CatalogItemModel.findById(CATALOG_ID);
    expect(item!.stock).toBe(5);
    expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(1);
  });

  it('succeeds when nothing fails — the fixture itself is sound', async () => {
    const sale = await run(
      onCreditInput(2000),
      new MongoSaleRepository(),
      new MongoCatalogItemRepository(),
      new MongoMovementRepository(),
      new MongoClientRepository(),
      new MongoCreditGrantedRepository(),
      new MongoAccountRepository(),
    );

    expect(sale.id).toBeDefined();
    expect(await SaleModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1); // first abono
    const item = await CatalogItemModel.findById(CATALOG_ID);
    expect(item!.stock).toBe(4); // decremented exactly once
  });
});