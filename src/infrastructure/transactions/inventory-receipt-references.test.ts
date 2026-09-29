import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ConflictError } from "../../core/domain/errors";
import { createPayable } from "../../core/application/payables/create-payable";
import { deletePayable } from "../../core/application/payables/delete-payable";
import { receiveInventoryReceipt } from "../../core/application/inventory/receive-inventory-receipt";
import { MongoAccountRepository } from "../repositories/account-repository";
import { MongoCatalogItemRepository } from "../repositories/catalog-repository";
import { MongoInventoryReceiptRepository } from "../repositories/inventory-receipt-repository";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoPayableRepository } from "../repositories/payable-repository";
import { AccountModel } from "../models/account";
import { CatalogItemModel } from "../models/catalog";
import { InventoryReceiptModel } from "../models/inventory-receipt";
import { InventoryStockRecordModel } from "../models/inventory-stock-record";
import { MovementModel } from "../models/movement";
import { PayableModel } from "../models/payable";
import { objectIdGenerator } from "../config/id-generator";
import { MongoUnitOfWork } from "./mongo-unit-of-work";

describe("inventory receipt financial references", () => {
  let mongod: MongoMemoryReplSet | undefined;
  const workspaceId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const accountId = "bbbbbbbbbbbbbbbbbbbbbbbb";

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
      instanceOpts: [{ launchTimeout: 45_000 }],
    });
    await mongoose.connect(mongod.getUri("twincap_receipt_reference_tests"));
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await Promise.all([
      AccountModel.deleteMany({}),
      CatalogItemModel.deleteMany({}),
      InventoryReceiptModel.deleteMany({}),
      InventoryStockRecordModel.deleteMany({}),
      MovementModel.deleteMany({}),
      PayableModel.deleteMany({}),
    ]);
    await AccountModel.create({
      _id: accountId,
      workspaceId,
      name: "Business account",
      currency: "COP",
      isFixed: false,
    });
  });

  it("refuses to delete a receipt-linked payable without deleting its payments", async () => {
    const payableRepo = new MongoPayableRepository();
    const movementRepo = new MongoMovementRepository();
    const accountRepo = new MongoAccountRepository();
    const uow = new MongoUnitOfWork();
    const date = new Date("2026-09-28T12:00:00.000Z");
    const payable = await createPayable(
      workspaceId,
      {
        counterparty: "Supplier",
        total: 15_000,
        initialPayment: 10_000,
        currency: "COP",
        accountId,
        context: "Business",
        date,
      },
      payableRepo,
      movementRepo,
      objectIdGenerator,
      accountRepo,
      uow,
    );
    const movementCount = await MovementModel.countDocuments({
      workspaceId,
      "link.refId": payable.id,
    });
    await InventoryReceiptModel.create({
      _id: "cccccccccccccccccccccccc",
      workspaceId,
      lines: [
        {
          catalogItemId: "dddddddddddddddddddddddd",
          quantity: 3,
          unit: "kg",
          stockQuantity: 3_000_000,
          lineAmount: 15_000,
        },
      ],
      total: 15_000,
      currency: "COP",
      initialPayment: 10_000,
      date,
      accountId,
      payableId: payable.id,
      actorUserId: "user-1",
    });

    await expect(
      deletePayable(workspaceId, payable.id, payableRepo, movementRepo, accountRepo, uow),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await PayableModel.countDocuments({ _id: payable.id, workspaceId })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId, "link.refId": payable.id })).toBe(
      movementCount,
    );
    expect(await InventoryReceiptModel.countDocuments({ workspaceId, payableId: payable.id })).toBe(
      1,
    );
  });

  it("pages receipt history by tenant, supplier/reference, and civil date", async () => {
    const otherWorkspace = "eeeeeeeeeeeeeeeeeeeeeeee";
    const base = {
      lines: [
        {
          catalogItemId: "dddddddddddddddddddddddd",
          quantity: 1,
          unit: "kg",
          stockQuantity: 1_000_000,
          lineAmount: 1000,
        },
      ],
      total: 1000,
      currency: "COP",
      initialPayment: 0,
      accountId,
      actorUserId: "user-1",
    };
    await InventoryReceiptModel.create([
      {
        ...base,
        _id: "ccccccccccccccccccccccc1",
        workspaceId,
        payableId: "ccccccccccccccccccccccc2",
        supplierName: "Acme [North]",
        reference: "INV-100",
        date: new Date("2026-09-10T00:00:00.000Z"),
      },
      {
        ...base,
        _id: "ccccccccccccccccccccccc3",
        workspaceId,
        payableId: "ccccccccccccccccccccccc4",
        supplierName: "Other supplier",
        reference: "INV-200",
        date: new Date("2026-09-20T00:00:00.000Z"),
      },
      {
        ...base,
        _id: "ccccccccccccccccccccccc5",
        workspaceId: otherWorkspace,
        payableId: "ccccccccccccccccccccccc6",
        supplierName: "Acme [North]",
        reference: "INV-300",
        date: new Date("2026-09-10T00:00:00.000Z"),
      },
    ]);

    const result = await new MongoInventoryReceiptRepository().findPage(workspaceId, {
      page: 1,
      pageSize: 20,
      search: "[North]",
      dateFrom: new Date("2026-09-01T00:00:00.000Z"),
      dateToExclusive: new Date("2026-09-15T00:00:00.000Z"),
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].supplierName).toBe("Acme [North]");
  });

  it("commits the receipt, payable, payment, and stock together", async () => {
    const itemId = "dddddddddddddddddddddddd";
    await CatalogItemModel.create({
      _id: itemId,
      workspaceId,
      name: "Test supply",
      unitPrice: 0,
      currency: "COP",
      type: "product",
      productRole: "supply",
      saleUnit: "kg",
      stock: 0,
    });

    const receipt = await receiveInventoryReceipt(
      workspaceId,
      {
        lines: [{ itemId, quantity: 2, unit: "kg", lineAmount: 15_000 }],
        currency: "COP",
        supplierName: "Supplier",
        date: new Date("2026-09-28T00:00:00.000Z"),
        accountId,
        initialPayment: 10_000,
      },
      {
        catalogRepo: new MongoCatalogItemRepository(),
        receiptRepo: new MongoInventoryReceiptRepository(),
        payableRepo: new MongoPayableRepository(),
        movementRepo: new MongoMovementRepository(),
        accountRepo: new MongoAccountRepository(),
        ids: objectIdGenerator,
        uow: new MongoUnitOfWork(),
      },
      "user-1",
    );

    expect((await CatalogItemModel.findById(itemId))?.stock).toBe(2_000_000);
    expect(await InventoryReceiptModel.countDocuments({ _id: receipt.id, workspaceId })).toBe(1);
    expect(await PayableModel.countDocuments({ _id: receipt.payableId!, workspaceId })).toBe(1);
    expect(
      await MovementModel.countDocuments({ workspaceId, "link.refId": receipt.payableId! }),
    ).toBe(1);
    expect(
      await InventoryStockRecordModel.countDocuments({ workspaceId, receiptId: receipt.id }),
    ).toBe(1);
  });

  it("records a fully-paid receipt expense without creating a payable", async () => {
    const itemId = "dddddddddddddddddddddddd";
    await CatalogItemModel.create({
      _id: itemId,
      workspaceId,
      name: "Paid supply",
      unitPrice: 0,
      currency: "COP",
      type: "product",
      productRole: "supply",
      saleUnit: "kg",
      stock: 0,
    });

    const receipt = await receiveInventoryReceipt(
      workspaceId,
      {
        lines: [{ itemId, quantity: 1, unit: "kg", lineAmount: 15_000 }],
        currency: "COP",
        date: new Date("2026-09-28T00:00:00.000Z"),
        accountId,
        initialPayment: 15_000,
      },
      {
        catalogRepo: new MongoCatalogItemRepository(),
        receiptRepo: new MongoInventoryReceiptRepository(),
        payableRepo: new MongoPayableRepository(),
        movementRepo: new MongoMovementRepository(),
        accountRepo: new MongoAccountRepository(),
        ids: objectIdGenerator,
        uow: new MongoUnitOfWork(),
      },
      "user-1",
    );

    expect(receipt.payableId).toBeUndefined();
    expect(await PayableModel.countDocuments({ workspaceId })).toBe(0);
    expect(await MovementModel.countDocuments({ workspaceId, "link.receiptId": receipt.id })).toBe(
      1,
    );
    expect(await InventoryReceiptModel.countDocuments({ _id: receipt.id, workspaceId })).toBe(1);
  });

  it("allows a second fully-paid receipt without payable in the same workspace", async () => {
    const itemId = "dddddddddddddddddddddddd";
    await CatalogItemModel.create({
      _id: itemId,
      workspaceId,
      name: "Paid supply",
      unitPrice: 0,
      currency: "COP",
      type: "product",
      productRole: "supply",
      saleUnit: "kg",
      stock: 0,
    });

    const first = await receiveInventoryReceipt(
      workspaceId,
      {
        lines: [{ itemId, quantity: 1, unit: "kg", lineAmount: 15_000 }],
        currency: "COP",
        date: new Date("2026-09-28T00:00:00.000Z"),
        accountId,
        initialPayment: 15_000,
      },
      {
        catalogRepo: new MongoCatalogItemRepository(),
        receiptRepo: new MongoInventoryReceiptRepository(),
        payableRepo: new MongoPayableRepository(),
        movementRepo: new MongoMovementRepository(),
        accountRepo: new MongoAccountRepository(),
        ids: objectIdGenerator,
        uow: new MongoUnitOfWork(),
      },
      "user-1",
    );
    const second = await receiveInventoryReceipt(
      workspaceId,
      {
        lines: [{ itemId, quantity: 2, unit: "kg", lineAmount: 9_000 }],
        currency: "COP",
        date: new Date("2026-09-28T00:00:00.000Z"),
        accountId,
        initialPayment: 9_000,
      },
      {
        catalogRepo: new MongoCatalogItemRepository(),
        receiptRepo: new MongoInventoryReceiptRepository(),
        payableRepo: new MongoPayableRepository(),
        movementRepo: new MongoMovementRepository(),
        accountRepo: new MongoAccountRepository(),
        ids: objectIdGenerator,
        uow: new MongoUnitOfWork(),
      },
      "user-1",
    );

    expect(await InventoryReceiptModel.countDocuments({ workspaceId })).toBe(2);
    expect(
      await InventoryReceiptModel.countDocuments({ workspaceId, payableId: { $exists: false } }),
    ).toBe(2);
    expect(
      await MovementModel.countDocuments({ workspaceId, "link.kind": "inventoryReceiptPayment" }),
    ).toBe(2);
    expect(
      await InventoryStockRecordModel.countDocuments({ workspaceId, receiptId: first.id }),
    ).toBe(1);
    expect(
      await InventoryStockRecordModel.countDocuments({ workspaceId, receiptId: second.id }),
    ).toBe(1);
    expect((await CatalogItemModel.findById(itemId))?.stock).toBe(3_000_000);
  });

  it("rolls back payable, payment, and stock if receipt persistence fails", async () => {
    const itemId = "dddddddddddddddddddddddd";
    await CatalogItemModel.create({
      _id: itemId,
      workspaceId,
      name: "Test supply",
      unitPrice: 0,
      currency: "COP",
      type: "product",
      productRole: "supply",
      saleUnit: "kg",
      stock: 0,
    });
    const receiptRepo = {
      create: async () => {
        throw new Error("receipt persistence failed");
      },
    } as unknown as MongoInventoryReceiptRepository;

    await expect(
      receiveInventoryReceipt(
        workspaceId,
        {
          lines: [{ itemId, quantity: 2, unit: "kg", lineAmount: 15_000 }],
          currency: "COP",
          supplierName: "Supplier",
          date: new Date("2026-09-28T00:00:00.000Z"),
          accountId,
          initialPayment: 10_000,
        },
        {
          catalogRepo: new MongoCatalogItemRepository(),
          receiptRepo,
          payableRepo: new MongoPayableRepository(),
          movementRepo: new MongoMovementRepository(),
          accountRepo: new MongoAccountRepository(),
          ids: objectIdGenerator,
          uow: new MongoUnitOfWork(),
        },
        "user-1",
      ),
    ).rejects.toThrow("receipt persistence failed");

    expect((await CatalogItemModel.findById(itemId))?.stock).toBe(0);
    expect(await PayableModel.countDocuments({ workspaceId })).toBe(0);
    expect(await MovementModel.countDocuments({ workspaceId })).toBe(0);
    expect(await InventoryStockRecordModel.countDocuments({ workspaceId })).toBe(0);
    expect(await InventoryReceiptModel.countDocuments({ workspaceId })).toBe(0);
  });
});
