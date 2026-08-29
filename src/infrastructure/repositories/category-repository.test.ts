import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { Category } from "../../core/domain/category";

const categoryCreate = vi.fn();
vi.mock("../models/category", () => ({
  CategoryModel: { create: (...args: unknown[]) => categoryCreate(...args) },
}));

import { MongoCategoryRepository } from "./category-repository";

function makeCategory(overrides: Partial<ConstructorParameters<typeof Category>[0]> = {}) {
  return new Category({
    id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId().toString(),
    name: "Comida",
    type: "expense",
    createdAt: new Date(),
    ...overrides,
  });
}

describe("MongoCategoryRepository.create (R8 Group-A gap)", () => {
  let repo: MongoCategoryRepository;

  beforeEach(() => {
    repo = new MongoCategoryRepository();
    categoryCreate.mockReset();
  });

  it("persists _id: category.id so movement categoryIds match the stored category _id", async () => {
    const category = makeCategory();
    // Mongoose create returns a doc whose _id echoes what was passed in.
    categoryCreate.mockResolvedValue({ ...category.toJSON(), _id: category.id });

    await repo.create(category);

    expect(categoryCreate).toHaveBeenCalledTimes(1);
    const docData = (categoryCreate as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0];
    expect((docData as { _id: unknown })._id).toBe(category.id);
    expect((docData as Record<string, unknown>).name).toBe(category.name);
    expect((docData as Record<string, unknown>).type).toBe("expense");
  });

  it("maps the stored _id back to the returned entity id", async () => {
    const category = makeCategory();
    categoryCreate.mockResolvedValue({
      ...category.toJSON(),
      _id: category.id,
      _doc: undefined,
    });

    const created = await repo.create(category);
    expect(created.id).toBe(category.id);
    expect(created.name).toBe("Comida");
  });
});