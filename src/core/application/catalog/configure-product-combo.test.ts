import { describe, expect, it, vi } from "vitest";
import { CatalogItem } from "../../domain/catalog";
import { Money } from "../../domain/money";
import { ConflictError, ValidationError } from "../../domain/errors";
import type { CatalogItemRepository } from "../../domain/repositories";
import type { SaleRepository } from "../../domain/repositories";
import type { UnitOfWork } from "../ports";
import { configureProductCombo } from "./configure-product-combo";

function product(input: {
  id: string;
  stock: number;
  saleUnit?: "unit" | "g";
  comboVersions?: ConstructorParameters<typeof CatalogItem>[0]["comboVersions"];
}) {
  return new CatalogItem({
    id: input.id,
    workspaceId: "workspace-1",
    name: input.id,
    unitPrice: new Money(1000, "COP"),
    type: "product",
    productRole: "sellable",
    saleUnit: input.saleUnit ?? "unit",
    stock: input.stock,
    comboVersions: input.comboVersions,
    createdAt: new Date(),
  });
}

function repository(items: CatalogItem[]) {
  return {
    findById: vi.fn(
      async (_workspaceId: string, id: string) => items.find((item) => item.id === id) ?? null,
    ),
    touchProduct: vi.fn().mockResolvedValue(true),
    appendComboVersion: vi.fn().mockResolvedValue(true),
  } as unknown as CatalogItemRepository & {
    appendComboVersion: ReturnType<typeof vi.fn>;
    touchProduct: ReturnType<typeof vi.fn>;
  };
}

const uow: UnitOfWork = { withTransaction: (callback) => callback({} as never) };
const saleRepo = { findByWorkspaceId: vi.fn().mockResolvedValue([]) } as unknown as SaleRepository;

describe("configureProductCombo", () => {
  it("appends a versioned fixed recipe and locks component references", async () => {
    const combo = product({ id: "combo", stock: 0 });
    const cup = product({ id: "cup", stock: 12 });
    const coffee = product({ id: "coffee", stock: 1_000_000, saleUnit: "g" });
    const repo = repository([combo, cup, coffee]);

    await configureProductCombo(
      "workspace-1",
      combo.id,
      {
        components: [
          { itemId: cup.id, quantity: 1, unit: "unit" },
          { itemId: coffee.id, quantity: 250, unit: "g" },
        ],
      },
      repo,
      saleRepo,
      uow,
    );

    expect(repo.appendComboVersion).toHaveBeenCalledWith(
      "workspace-1",
      "combo",
      0,
      expect.objectContaining({
        version: 1,
        components: [
          expect.objectContaining({ itemId: "cup", stockQuantity: 1 }),
          expect.objectContaining({ itemId: "coffee", stockQuantity: 250_000 }),
        ],
      }),
      expect.anything(),
    );
    expect(repo.touchProduct).toHaveBeenCalledTimes(2);
  });

  it("rejects stocked products and nested combos", async () => {
    const stockedCombo = product({ id: "combo", stock: 1 });
    const stockedRepo = repository([stockedCombo]);
    await expect(
      configureProductCombo(
        "workspace-1",
        "combo",
        { components: [{ itemId: "x", quantity: 1, unit: "unit" }] },
        stockedRepo,
        saleRepo,
        uow,
      ),
    ).rejects.toThrow(ValidationError);

    const comboVersion = {
      version: 1,
      components: [
        { itemId: "x", name: "X", quantity: 1, unit: "unit" as const, stockQuantity: 1 },
      ],
      createdAt: new Date(),
    };
    const outer = product({ id: "outer", stock: 0 });
    const inner = product({ id: "inner", stock: 0, comboVersions: [comboVersion] });
    await expect(
      configureProductCombo(
        "workspace-1",
        "outer",
        { components: [{ itemId: "inner", quantity: 1, unit: "unit" }] },
        repository([outer, inner]),
        saleRepo,
        uow,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("reports a concurrent version append conflict", async () => {
    const combo = product({ id: "combo", stock: 0 });
    const item = product({ id: "item", stock: 2 });
    const repo = repository([combo, item]);
    repo.appendComboVersion.mockResolvedValue(false);
    await expect(
      configureProductCombo(
        "workspace-1",
        "combo",
        { components: [{ itemId: "item", quantity: 1, unit: "unit" }] },
        repo,
        saleRepo,
        uow,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("does not convert a previously sold product and break its old sale reversal", async () => {
    const combo = product({ id: "combo", stock: 0 });
    const historyRepo = {
      findByWorkspaceId: vi.fn().mockResolvedValue([{ items: [{ itemId: "combo" }] }]),
    } as unknown as SaleRepository;
    const repo = repository([combo, product({ id: "component", stock: 2 })]);
    await expect(
      configureProductCombo(
        "workspace-1",
        "combo",
        { components: [{ itemId: "component", quantity: 1, unit: "unit" }] },
        repo,
        historyRepo,
        uow,
      ),
    ).rejects.toThrow("sales history");
    expect(repo.appendComboVersion).not.toHaveBeenCalled();
  });
});
