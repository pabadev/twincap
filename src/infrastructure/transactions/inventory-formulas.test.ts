import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createSale } from "../../core/application/sales/create-sale";
import { deleteSale } from "../../core/application/sales/delete-sale";
import { deleteCatalogItem } from "../../core/application/catalog/delete-catalog-item";
import { configureProductCombo } from "../../core/application/catalog/configure-product-combo";
import { MongoSaleRepository } from "../repositories/sale-repository";
import { MongoCatalogItemRepository } from "../repositories/catalog-repository";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoClientRepository } from "../repositories/client-repository";
import { MongoCreditGrantedRepository } from "../repositories/credit-granted-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { AccountModel } from "../models/account";
import { SaleModel } from "../models/sale";
import { CatalogItemModel } from "../models/catalog";
import { MovementModel } from "../models/movement";
import { CreditGrantedModel } from "../models/credit-granted";
import { InventoryStockRecordModel } from "../models/inventory-stock-record";
import { objectIdGenerator } from "../config/id-generator";
import { MongoUnitOfWork } from "./mongo-unit-of-work";

describe("prepared formulas and fixed combos — transactional inventory", () => {
  let mongod: MongoMemoryReplSet | undefined;
  const workspaceId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const accountId = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const preparedId = "cccccccccccccccccccccccc";
  const supplyId = "dddddddddddddddddddddddd";
  const comboId = "eeeeeeeeeeeeeeeeeeeeeeee";
  const comboUnitId = "ffffffffffffffffffffffff";
  const comboWeightId = "111111111111111111111111";
  const foreignProductId = "222222222222222222222222";
  const date = new Date("2026-09-28T12:00:00.000Z");

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
      instanceOpts: [{ launchTimeout: 45_000 }],
    });
    await mongoose.connect(mongod.getUri("twincap_formula_tests"));
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([
      AccountModel.deleteMany({}),
      SaleModel.deleteMany({}),
      CatalogItemModel.deleteMany({}),
      MovementModel.deleteMany({}),
      CreditGrantedModel.deleteMany({}),
      InventoryStockRecordModel.deleteMany({}),
    ]);
    await AccountModel.create({
      _id: accountId,
      workspaceId,
      name: "Cash",
      currency: "COP",
      isFixed: false,
    });
    await CatalogItemModel.create([
      {
        _id: preparedId,
        workspaceId,
        name: "Bread",
        unitPrice: 12000,
        currency: "COP",
        type: "product",
        productRole: "sellable",
        saleUnit: "unit",
        stock: 4,
        formulaVersions: [
          {
            version: 1,
            yieldQuantity: 1,
            yieldUnit: "unit",
            yieldStockQuantity: 1,
            components: [
              {
                itemId: new mongoose.Types.ObjectId(supplyId),
                name: "Flour",
                quantity: 250,
                unit: "g",
                stockQuantity: 250000,
              },
            ],
            createdAt: date,
          },
        ],
      },
      {
        _id: supplyId,
        workspaceId,
        name: "Flour",
        unitPrice: 0,
        currency: "COP",
        type: "product",
        productRole: "supply",
        saleUnit: "g",
        stock: 1_000_000,
      },
      {
        _id: comboId,
        workspaceId,
        name: "Coffee set",
        unitPrice: 15000,
        currency: "COP",
        type: "product",
        productRole: "sellable",
        saleUnit: "unit",
        stock: 0,
        comboVersions: [
          {
            version: 1,
            components: [
              {
                itemId: new mongoose.Types.ObjectId(comboUnitId),
                name: "Cup",
                quantity: 1,
                unit: "unit",
                stockQuantity: 1,
              },
              {
                itemId: new mongoose.Types.ObjectId(comboWeightId),
                name: "Coffee beans",
                quantity: 250,
                unit: "g",
                stockQuantity: 250_000,
              },
            ],
            createdAt: date,
          },
        ],
      },
      {
        _id: comboUnitId,
        workspaceId,
        name: "Cup",
        unitPrice: 1000,
        currency: "COP",
        type: "product",
        productRole: "sellable",
        saleUnit: "unit",
        stock: 5,
      },
      {
        _id: comboWeightId,
        workspaceId,
        name: "Coffee beans",
        unitPrice: 200,
        currency: "COP",
        type: "product",
        productRole: "sellable",
        saleUnit: "g",
        stock: 1_000_000,
      },
    ]);
  });

  function input() {
    return {
      items: [
        {
          itemId: preparedId,
          quantity: 2,
          unitPrice: 12000,
          formula: {
            version: 1,
            components: [{ itemId: supplyId, quantity: 300, unit: "g" as const }],
          },
        },
      ],
      accountId,
      date,
      paymentMode: "paid-in-full" as const,
      currency: "COP" as const,
    };
  }

  async function runSale() {
    return createSale(
      workspaceId,
      input(),
      new MongoSaleRepository(),
      new MongoCatalogItemRepository(),
      new MongoMovementRepository(),
      objectIdGenerator,
      new MongoClientRepository(),
      new MongoCreditGrantedRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  async function runComboSale(quantity = 1) {
    return createSale(
      workspaceId,
      {
        items: [{ itemId: comboId, quantity, unitPrice: 15000, comboVersion: 1 }],
        accountId,
        date,
        paymentMode: "paid-in-full",
        currency: "COP",
      },
      new MongoSaleRepository(),
      new MongoCatalogItemRepository(),
      new MongoMovementRepository(),
      objectIdGenerator,
      new MongoClientRepository(),
      new MongoCreditGrantedRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  it("consumes customized components once and does not duplicate prepared stock", async () => {
    const sale = await runSale();
    const prepared = await CatalogItemModel.findById(preparedId);
    const supply = await CatalogItemModel.findById(supplyId);
    expect(prepared?.stock).toBe(4);
    expect(supply?.stock).toBe(400_000);
    expect(sale.items[0].formulaSnapshot?.components[0].stockQuantity).toBe(600_000);
    expect(await InventoryStockRecordModel.countDocuments({ saleId: sale.id, kind: "sale" })).toBe(
      1,
    );
  });

  it("prevents deleting a supply referenced by a prepared formula", async () => {
    await expect(
      deleteCatalogItem(
        workspaceId,
        supplyId,
        new MongoCatalogItemRepository(),
        new MongoSaleRepository(),
        new MongoUnitOfWork(),
      ),
    ).rejects.toThrow("used in a prepared product formula");
    expect(await CatalogItemModel.exists({ _id: supplyId })).not.toBeNull();
  });

  it("rolls back sale, payment, prepared touch, and partial component deductions when stock is short", async () => {
    await CatalogItemModel.updateOne({ _id: supplyId }, { $set: { stock: 100_000 } });
    await expect(runSale()).rejects.toThrow("Insufficient stock");
    expect(await SaleModel.countDocuments({ workspaceId })).toBe(0);
    expect(await MovementModel.countDocuments({ workspaceId })).toBe(0);
    expect((await CatalogItemModel.findById(preparedId))?.stock).toBe(4);
    expect((await CatalogItemModel.findById(supplyId))?.stock).toBe(100_000);
    expect(await InventoryStockRecordModel.countDocuments({ workspaceId, kind: "sale" })).toBe(0);
  });

  it("allows only the sale that fits under concurrent component consumption", async () => {
    const results = await Promise.allSettled([runSale(), runSale()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await SaleModel.countDocuments({ workspaceId })).toBe(1);
    expect((await CatalogItemModel.findById(supplyId))?.stock).toBe(400_000);
    expect(await InventoryStockRecordModel.countDocuments({ workspaceId, kind: "sale" })).toBe(1);
  });

  it("reverses using the persisted sale snapshot after formula configuration changes", async () => {
    const sale = await runSale();
    await CatalogItemModel.updateOne(
      { _id: preparedId },
      { $set: { "formulaVersions.0.components.0.quantity": 999 } },
    );
    await deleteSale(
      workspaceId,
      sale.id,
      new MongoSaleRepository(),
      new MongoCatalogItemRepository(),
      new MongoMovementRepository(),
      new MongoCreditGrantedRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
    expect((await CatalogItemModel.findById(preparedId))?.stock).toBe(4);
    expect((await CatalogItemModel.findById(supplyId))?.stock).toBe(1_000_000);
  });

  it("consumes fixed combo components atomically without creating combo stock", async () => {
    const sale = await runComboSale(2);
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0].comboSnapshot?.components).toEqual([
      expect.objectContaining({ itemId: comboUnitId, stockQuantity: 2 }),
      expect.objectContaining({ itemId: comboWeightId, stockQuantity: 500_000 }),
    ]);
    expect((await CatalogItemModel.findById(comboId))?.stock).toBe(0);
    expect((await CatalogItemModel.findById(comboUnitId))?.stock).toBe(3);
    expect((await CatalogItemModel.findById(comboWeightId))?.stock).toBe(500_000);
  });

  it("does not allow a combo composition to reference another workspace's product", async () => {
    await CatalogItemModel.create({
      _id: foreignProductId,
      workspaceId: "999999999999999999999999",
      name: "Foreign stock",
      unitPrice: 1000,
      currency: "COP",
      type: "product",
      productRole: "sellable",
      saleUnit: "unit",
      stock: 5,
    });
    await expect(
      configureProductCombo(
        workspaceId,
        comboId,
        { components: [{ itemId: foreignProductId, quantity: 1, unit: "unit" }] },
        new MongoCatalogItemRepository(),
        new MongoSaleRepository(),
        new MongoUnitOfWork(),
      ),
    ).rejects.toThrow("Combo components must be stocked sellable products");
    expect((await CatalogItemModel.findById(comboId))?.comboVersions).toHaveLength(1);
  });

  it("rolls back the sale if any combo component is short", async () => {
    await CatalogItemModel.updateOne({ _id: comboUnitId }, { $set: { stock: 0 } });
    await expect(runComboSale()).rejects.toThrow("Insufficient stock");
    expect(await SaleModel.countDocuments({ workspaceId })).toBe(0);
    expect((await CatalogItemModel.findById(comboWeightId))?.stock).toBe(1_000_000);
    expect((await CatalogItemModel.findById(comboId))?.stock).toBe(0);
  });

  it("permits only one concurrent sale when combo components are limited", async () => {
    await CatalogItemModel.updateOne({ _id: comboUnitId }, { $set: { stock: 1 } });
    const results = await Promise.allSettled([runComboSale(), runComboSale()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await SaleModel.countDocuments({ workspaceId })).toBe(1);
    expect((await CatalogItemModel.findById(comboUnitId))?.stock).toBe(0);
    expect((await CatalogItemModel.findById(comboWeightId))?.stock).toBe(750_000);
  });

  it("restores the exact combo snapshot on sale deletion and protects referenced products", async () => {
    const sale = await runComboSale(2);
    await expect(
      deleteCatalogItem(
        workspaceId,
        comboUnitId,
        new MongoCatalogItemRepository(),
        new MongoSaleRepository(),
        new MongoUnitOfWork(),
      ),
    ).rejects.toThrow("used in a combo");
    await configureProductCombo(
      workspaceId,
      comboId,
      {
        components: [
          { itemId: comboUnitId, quantity: 2, unit: "unit" },
          { itemId: comboWeightId, quantity: 100, unit: "g" },
        ],
      },
      new MongoCatalogItemRepository(),
      new MongoSaleRepository(),
      new MongoUnitOfWork(),
    );
    expect((await CatalogItemModel.findById(comboId))?.comboVersions).toHaveLength(2);
    expect(sale.items[0].comboSnapshot?.version).toBe(1);
    await deleteSale(
      workspaceId,
      sale.id,
      new MongoSaleRepository(),
      new MongoCatalogItemRepository(),
      new MongoMovementRepository(),
      new MongoCreditGrantedRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
    expect((await CatalogItemModel.findById(comboUnitId))?.stock).toBe(5);
    expect((await CatalogItemModel.findById(comboWeightId))?.stock).toBe(1_000_000);
  });
});
