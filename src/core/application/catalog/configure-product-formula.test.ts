import { describe, expect, it, vi } from "vitest";
import { CatalogItem } from "../../domain/catalog";
import { Money } from "../../domain/money";
import { ConflictError, ValidationError } from "../../domain/errors";
import type { CatalogItemRepository } from "../../domain/repositories";
import type { UnitOfWork } from "../ports";
import { configureProductFormula } from "./configure-product-formula";

function item(
  input: Partial<ConstructorParameters<typeof CatalogItem>[0]> & {
    id: string;
    role?: "sellable" | "supply" | "both";
  },
) {
  return new CatalogItem({
    id: input.id,
    workspaceId: "workspace-1",
    name: input.name ?? input.id,
    unitPrice:
      input.unitPrice ??
      (input.role === "supply" ? Money.nonNegative(0, "COP") : new Money(1000, "COP")),
    type: "product",
    productRole: input.role,
    saleUnit: input.saleUnit ?? "unit",
    stock: 10,
    createdAt: new Date(),
    ...input,
  });
}

function repository(items: CatalogItem[]) {
  return {
    findById: vi.fn(
      async (_workspaceId: string, id: string) => items.find((entry) => entry.id === id) ?? null,
    ),
    touchProduct: vi.fn().mockResolvedValue(true),
    appendFormulaVersion: vi.fn().mockResolvedValue(true),
  } as unknown as CatalogItemRepository & {
    appendFormulaVersion: ReturnType<typeof vi.fn>;
    touchProduct: ReturnType<typeof vi.fn>;
  };
}

const uow: UnitOfWork = {
  withTransaction: (callback) => callback({} as never),
};

describe("configureProductFormula", () => {
  it("appends a new immutable version with tenant-scoped component snapshots", async () => {
    const prepared = item({ id: "prepared" });
    const supply = item({ id: "flour", name: "Flour", role: "supply", saleUnit: "g" });
    const repo = repository([prepared, supply]);

    await configureProductFormula(
      "workspace-1",
      prepared.id,
      {
        yieldQuantity: 1,
        yieldUnit: "unit",
        components: [{ itemId: supply.id, quantity: 250, unit: "g" }],
      },
      repo,
      uow,
    );

    expect(repo.appendFormulaVersion).toHaveBeenCalledWith(
      "workspace-1",
      "prepared",
      0,
      expect.objectContaining({
        version: 1,
        components: [
          expect.objectContaining({ itemId: "flour", name: "Flour", stockQuantity: 250_000 }),
        ],
      }),
      expect.anything(),
    );
    expect(repo.touchProduct).toHaveBeenCalledWith("workspace-1", "flour", expect.anything());
    expect(prepared.formulaVersions).toHaveLength(0);
  });

  it("rejects a self-reference and non-supply components", async () => {
    const prepared = item({ id: "prepared" });
    const repo = repository([prepared]);
    const input = {
      yieldQuantity: 1,
      yieldUnit: "unit" as const,
      components: [{ itemId: "prepared", quantity: 1, unit: "unit" as const }],
    };
    await expect(
      configureProductFormula("workspace-1", prepared.id, input, repo, uow),
    ).rejects.toThrow(ValidationError);
    expect(repo.appendFormulaVersion).not.toHaveBeenCalled();
  });

  it("reports a concurrent version append conflict", async () => {
    const prepared = item({ id: "prepared" });
    const supply = item({ id: "flour", role: "both", saleUnit: "g" });
    const repo = repository([prepared, supply]);
    repo.appendFormulaVersion.mockResolvedValue(false);
    await expect(
      configureProductFormula(
        "workspace-1",
        prepared.id,
        {
          yieldQuantity: 1,
          yieldUnit: "unit",
          components: [{ itemId: supply.id, quantity: 100, unit: "g" }],
        },
        repo,
        uow,
      ),
    ).rejects.toThrow(ConflictError);
  });
});
