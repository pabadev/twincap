import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Movement, type MovementLink } from "../../core/domain/movement";
import { Category } from "../../core/domain/category";
import { Money } from "../../core/domain/money";
import type { Currency } from "../../core/domain/currency";
import { MovementModel, type MovementDoc } from "../models/movement";
import { toMovementDocData, toMovementEntity } from "./movement";

/**
 * R14-N §25-D: REAL round-trip of the Movement mapper — Domain → Mongo
 * document → Domain — and semantic equality of the result.
 *
 * This is the regression guard for the §24 defect: `link.saleId` (I12) was
 * defined on the domain entity and the Mongoose schema but the mapper only
 * persisted/reconstructed `kind/refId/opId`, so `saleId` silently vanished on
 * write-then-read. It exercises the ACTUAL Mongoose model against an in-memory
 * MongoDB (no fakes, no seed documents) so the contract is proven end-to-end.
 */
describe("Movement mapper round-trip (R14-N §25-D)", () => {
  let mongod: MongoMemoryServer;

  const workspaceId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const accountId = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const categoryId = "cccccccccccccccccccccccc";
  const movementId = "dddddddddddddddddddddddd";
  const currency: Currency = "COP";

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri("twincap_movement_mapper"));
    await MovementModel.init();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 60_000);

  beforeEach(async () => {
    await MovementModel.deleteMany({});
  });

  function makeCategory(): Category {
    return new Category({
      id: categoryId,
      workspaceId,
      name: "Ventas",
      type: "income",
      createdAt: new Date("2026-09-06"),
    });
  }

  function makeMovement(link: MovementLink | undefined, createdAt = new Date()): Movement {
    return new Movement({
      id: movementId,
      workspaceId,
      accountId,
      category: makeCategory(),
      type: "income",
      amount: new Money(15000, currency),
      date: new Date("2026-09-06"),
      note: "Abono a crédito otorgado",
      context: "Business",
      link,
      createdAt,
    });
  }

  /** Persist via the real Mongoose model, then read it back into a domain entity. */
  async function roundTrip(movement: Movement): Promise<{
    doc: mongoose.HydratedDocument<MovementDoc>;
    entity: Movement;
  }> {
    const docData = toMovementDocData(movement) as unknown as MovementDoc;
    const created = await MovementModel.create({
      ...docData,
      _id: movement.id,
    });
    const readBack = await MovementModel.findById(movement.id).exec();
    if (!readBack) throw new Error("movement not found after create");
    const entity = toMovementEntity(readBack, makeCategory(), currency);
    return { doc: created, entity };
  }

  it("round-trips link.saleId present (sale-born credit abono) with full semantic equality", async () => {
    const link: MovementLink = {
      kind: "creditGrantedAbono",
      refId: "credit-123",
      saleId: "sale-1",
      opId: "op-abc",
    };
    const original = makeMovement(link);

    const { entity } = await roundTrip(original);

    expect(entity.id).toBe(movementId);
    expect(entity.workspaceId).toBe(workspaceId);
    expect(entity.accountId).toBe(accountId);
    expect(entity.categoryId).toBe(categoryId);
    expect(entity.type).toBe("income");
    expect(entity.amount.amount).toBe(15000);
    expect(entity.amount.currency).toBe(currency);
    expect(entity.signedAmount).toBe(15000);
    expect(entity.date).toEqual(new Date("2026-09-06"));
    expect(entity.context).toBe("Business");
    expect(entity.link).toEqual(link);
    expect(entity.createdAt).toBeInstanceOf(Date);
  });

  it("round-trips a link without saleId leaving the property absent on the entity", async () => {
    const link: MovementLink = {
      kind: "creditGrantedAbono",
      refId: "credit-456",
      opId: "op-def",
    };
    const original = makeMovement(link);

    const { entity } = await roundTrip(original);

    expect(entity.link).toBeDefined();
    // Exact semantic equality against the original link: the reconstructed
    // link must not carry a saleId VALUE. (Vitest toEqual treats an
    // undefined-valued key as absent, so this is the precise comparison.)
    expect(entity.link).toEqual(link);
    expect(entity.link?.saleId).toBeUndefined();
  });

  it("round-trips a movement without a link at all", async () => {
    const original = makeMovement(undefined);

    const { entity } = await roundTrip(original);

    expect(entity.link).toBeUndefined();
    expect(entity.isSystemLinked()).toBe(false);
    expect(entity.id).toBe(movementId);
    expect(entity.amount.amount).toBe(15000);
  });

  it("persists link.opId on the stored document (MOV-5 idempotency key)", async () => {
    const link: MovementLink = {
      kind: "creditGrantedAbono",
      refId: "credit-789",
      saleId: "sale-9",
      opId: "op-ghi",
    };
    const { doc, entity } = await roundTrip(makeMovement(link));

    expect(doc.link?.opId).toBe("op-ghi");
    expect(doc.link?.saleId).toBe("sale-9");
    expect(entity.link?.opId).toBe("op-ghi");
  });
});
