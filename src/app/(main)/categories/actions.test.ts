import { describe, it, expect, vi, beforeEach } from "vitest";

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repository, and next/cache.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { getT } = vi.hoisted(() => ({ getT: vi.fn() }));
const { MongoCategoryRepository } = vi.hoisted(() => ({
  MongoCategoryRepository: vi.fn(),
}));

vi.mock("../../../infrastructure/auth/getCurrentUser", () => ({ getCurrentUser }));
vi.mock("../../../infrastructure/db/connection", () => ({ connectDb }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("../../../i18n/server", () => ({ getT }));
vi.mock("../../../infrastructure/repositories/category-repository", () => ({
  MongoCategoryRepository,
}));

const { createSuggestedCategoriesAction, updateCategoryAction } = await import("./actions");

function categoryEntity() {
  return {
    id: "cat-1",
    workspaceId: "user-1",
    name: "Comida",
    type: "expense",
    createdAt: new Date(),
  };
}

function renameFormData(name = "Alimentación"): FormData {
  const fd = new FormData();
  fd.append("categoryId", "cat-1");
  fd.append("name", name);
  return fd;
}

describe("updateCategoryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "user-1" });
    connectDb.mockResolvedValue(undefined);
    MongoCategoryRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(categoryEntity()),
      findByNameAndType: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it("renames the category and returns the success toast key", async () => {
    const result = await updateCategoryAction(null, renameFormData());

    expect(result).toEqual({ success: "categoryUpdated" });
    expect(revalidatePath).toHaveBeenCalledWith("/categories");
    expect(revalidatePath).toHaveBeenCalledWith("/movements");
  });

  it("maps a missing category to the notFound error key", async () => {
    MongoCategoryRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));

    const result = await updateCategoryAction(null, renameFormData());

    expect(result).toEqual({ error: "error.notFound" });
  });

  it("rejects unauthenticated callers before any data access", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await updateCategoryAction(null, renameFormData());

    expect(result).toEqual({ error: "error.unauthorized" });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoCategoryRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createSuggestedCategoriesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "workspace-1" });
    connectDb.mockResolvedValue(undefined);
    getT.mockResolvedValue(
      (key: string) =>
        ({ incomeSalary: "Salario", expenseGroceries: "Mercado y víveres" })[key] ?? key,
    );
  });

  it("creates only allowlisted suggestions in the authenticated workspace", async () => {
    const create = vi.fn().mockImplementation(async (category) => category);
    MongoCategoryRepository.mockImplementation(() => ({
      findByNameAndType: vi.fn().mockResolvedValue(null),
      create,
    }));
    const formData = new FormData();
    formData.append("suggestionId", "salary");
    formData.append("suggestionId", "groceries");

    const result = await createSuggestedCategoriesAction(null, formData);

    expect(result).toMatchObject({ success: "suggestionsAdded", created: 2, skipped: 0 });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map(([category]) => [category.workspaceId, category.name])).toEqual([
      ["workspace-1", "Salario"],
      ["workspace-1", "Mercado y víveres"],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/categories");
    expect(revalidatePath).toHaveBeenCalledWith("/movements");
  });

  it("rejects unknown suggestion ids before connecting to the database", async () => {
    const formData = new FormData();
    formData.append("suggestionId", "arbitrary-user-input");

    const result = await createSuggestedCategoriesAction(null, formData);

    expect(result).toEqual({ error: "error.invalidInput" });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoCategoryRepository).not.toHaveBeenCalled();
  });
});
