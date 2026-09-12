import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ConflictError, MOVEMENT_MODIFIED_MSG } from "../../core/domain/errors";
import { updateMovement } from "../../core/application/movements/update-movement";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { MongoCategoryRepository } from "../repositories/category-repository";
import { MongoUnitOfWork } from "./mongo-unit-of-work";
import { AccountModel } from "../models/account";
import { CategoryModel } from "../models/category";
import { MovementModel } from "../models/movement";

/**
 * R15.3.1 P2 — concurrent movement EDIT (CAS on the movement document `__v`).
 *
 * REAL repositories + REAL MongoUnitOfWork + REAL use case against a shared
 * single-node MongoMemoryReplSet (binary PINNED to 7.0.41 — same reason as the
 * Fase 2/4/5 suites: latest mongod crashes on Windows).
 *
 * What this suite proves:
 *   1. updateMovement × updateMovement on the SAME manual movement: EXACTLY
 *      one edit commits; the loser rejects with ConflictError(MOVEMENT_MODIFIED_MSG)
 *      — never NoSuchTransaction / TransientTransactionError, never a silent
 *      lost update (the final note is the winner's, not the loser's).
 *   2. The persisted document's `__v` advanced 0 → 1, and a re-read through the
 *      repository surfaces `version: 1` for the UI to CAS against next.
 */
describe("R15.3.1 P2 — movement edit concurrency (CAS `__v`)", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const ACC = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const CAT = "cccccccccccccccccccccccc";
  const MOV = "dddddddddddddddddddddddd";

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_movements_p2"));
    await AccountModel.create([
      { _id: ACC, workspaceId: WS, name: "Efectivo", currency: "COP", isFixed: false },
    ]);
    await CategoryModel.create([
      { _id: CAT, workspaceId: WS, name: "Sueldo", type: "income" },
    ]);
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await MovementModel.deleteMany({});
    // The movement starts at __v 0 on every round (fresh insert — Mongoose
    // versionKey default), so the CAS assert is deterministic.
    await MovementModel.create({
      _id: MOV,
      workspaceId: WS,
      accountId: ACC,
      categoryId: CAT,
      type: "income",
      amount: 100_000,
      signedAmount: 100_000,
      date: new Date("2026-09-01"),
      note: "initial note",
      context: "Personal",
    });
  });

  it.each([0, 1, 2, 3, 4])(
    "updateMovement × updateMovement — round %i: exactamente 1 gana; el otro ConflictError(MOVEMENT_MODIFIED_MSG); sin lost update; __v 0→1",
    async () => {
      // Both editors read the SAME snapshot version from the repo (equivalent
      // to the hidden `version` field the modal would carry).
      const movementRepo = new MongoMovementRepository();
      const initial = await movementRepo.findById(WS, MOV);
      expect(initial).not.toBeNull();
      expect(initial!.version).toBe(0);

      const settled = await Promise.allSettled([
        updateMovement(
          WS,
          { movementId: MOV, note: "edited by A", version: initial!.version },
          new MongoMovementRepository(),
          new MongoCategoryRepository(),
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
        updateMovement(
          WS,
          { movementId: MOV, note: "edited by B", version: initial!.version },
          new MongoMovementRepository(),
          new MongoCategoryRepository(),
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
      ]);

      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      const rejected = settled.filter((s) => s.status === "rejected");

      // EXACTLY one editor commits.
      expect(fulfilled).toHaveLength(1);
      // The loser fails ONLY with the CAS conflict — never a driver-level
      // transaction error leaking to the user.
      expect(rejected).toHaveLength(1);
      for (const r of rejected) {
        const msg = r.reason?.message ?? String(r.reason);
        expect(msg).not.toContain("NoSuchTransaction");
        expect(msg).not.toContain("TransientTransactionError");
        expect(r.reason).toBeInstanceOf(ConflictError);
        expect(msg).toBe(MOVEMENT_MODIFIED_MSG);
      }

      // The persisted doc advanced 0 → 1 (CAS bump) and holds the WINNER's
      // note — the loser's edit could not silently overwrite it.
      const doc = (await MovementModel.findById(MOV).lean()) as unknown as {
        note?: string;
        __v?: number;
      };
      expect(doc!.__v).toBe(1);
      const winnerNote = fulfilled[0].status === "fulfilled" ? fulfilled[0].value.note : null;
      expect(["edited by A", "edited by B"]).toContain(winnerNote);
      expect(doc!.note).toBe(winnerNote);

      // The repository surfaces the bumped version for the next edit.
      const rebased = await movementRepo.findById(WS, MOV);
      expect(rebased!.version).toBe(1);
    },
    120_000,
  );
});