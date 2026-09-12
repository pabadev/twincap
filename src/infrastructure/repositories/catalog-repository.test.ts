import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { ValidationError } from "../../core/domain/errors";

/**
 * R15.3.1 P3: `decrementStock` rejects non-positive/fractional quantities
 * BEFORE touching the DB (discrete-count semantics) and relies on the Mongo
 * atomic `$gte` filter to never decrement below zero — even under concurrent
 * sales. The Mongoose model is mocked so these tests never open a connection.
 */
const updateOne = vi.fn();

vi.mock("../models/catalog", () => ({
  CatalogItemModel: {
    // The repo chains `.exec()` on the query builder.
    updateOne: (...args: unknown[]) => ({ exec: () => updateOne(...args) }),
  },
}));

import { MongoCatalogItemRepository } from "./catalog-repository";

beforeEach(() => {
  updateOne.mockReset();
});

/** Valid 24-hex ObjectId strings — the repo casts workspaceId via `new Types.ObjectId`. */
const WS = new Types.ObjectId().toHexString();
const ITEM = new Types.ObjectId().toHexString();

describe("MongoCatalogItemRepository.decrementStock", () => {
  it("rejects zero quantity before touching the DB", async () => {
    const repo = new MongoCatalogItemRepository();
    await expect(repo.decrementStock(WS, ITEM, 0)).rejects.toThrow(
      ValidationError,
    );
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("rejects negative quantity before touching the DB", async () => {
    const repo = new MongoCatalogItemRepository();
    await expect(repo.decrementStock(WS, ITEM, -3)).rejects.toThrow(
      /positive whole number/,
    );
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("rejects fractional quantity before touching the DB — discrete count (R15.3.1 P3)", async () => {
    const repo = new MongoCatalogItemRepository();
    await expect(repo.decrementStock(WS, ITEM, 1.5)).rejects.toThrow(
      ValidationError,
    );
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("decrements atomically with a $gte stock filter when the quantity is valid", async () => {
    updateOne.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
    const repo = new MongoCatalogItemRepository();
    const ok = await repo.decrementStock(WS, ITEM, 5);
    expect(ok).toBe(true);
    expect(updateOne).toHaveBeenCalledWith(
      {
        _id: ITEM,
        workspaceId: expect.anything(),
        stock: { $gte: 5 },
      },
      { $inc: { stock: -5 } },
      expect.anything(),
    );
  });

  it("returns false (never a negative stock) when stock is insufficient — atomic guard", async () => {
    updateOne.mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });
    const repo = new MongoCatalogItemRepository();
    const ok = await repo.decrementStock(WS, ITEM, 5);
    expect(ok).toBe(false);
    expect(updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ stock: { $gte: 5 } }),
      { $inc: { stock: -5 } },
      expect.anything(),
    );
  });
});