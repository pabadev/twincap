import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ConflictError, DEBT_MODIFIED_MSG } from "../../core/domain/errors";
import { createCreditReceived } from "../../core/application/credits-received/create-credit-received";
import { addAbono as addAbonoReceived } from "../../core/application/credits-received/add-abono";
import { createCreditGranted } from "../../core/application/credits-granted/create-credit-granted";
import { addAbono as addAbonoGranted } from "../../core/application/credits-granted/add-abono";
import { writeOffCreditGranted, WRITE_OFF_ALREADY_MSG, WRITE_OFF_PAID_MSG } from "../../core/application/credits-granted/write-off-credit-granted";
import { MongoCreditReceivedRepository } from "../repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../repositories/credit-granted-repository";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { objectIdGenerator } from "../config/id-generator";
import { MongoUnitOfWork } from "./mongo-unit-of-work";
import { AccountModel } from "../models/account";
import { CreditReceivedModel } from "../models/credit-received";
import { CreditGrantedModel } from "../models/credit-granted";
import { MovementModel } from "../models/movement";

/**
 * R15 Fase 4 — Optimistic Concurrency (CAS) via `__v` on debt aggregates.
 *
 * REAL repositories + REAL MongoUnitOfWork + REAL use cases against a shared
 * single-node MongoMemoryReplSet (binary PINNED to 7.0.41 — same reason as the
 * Fase 2 rollback suite: latest mongod crashes on Windows).
 *
 * What this suite proves:
 *   1. CAS DIRECT (repo-level): a write with a stale `expectedVersion` is
 *      rejected with ConflictError(DEBT_MODIFIED_MSG) and leaves NO effect.
 *   2. IDEMPOTENCY: re-pushing the same movementId is a silent no-op — no
 *      duplicate abono, no version bump (retry-safe guard).
 *   3. CONCURRENCY: N parallel addAbono transactions over one credit converge
 *      to exactly floor(pending/amount) winners. Losers fail by RE-VALIDATION
 *      after the driver's WriteConflict retry re-reads fresh state (they never
 *      see the CAS error — the CAS only guards the direct path).
 *   4. WRITE-OFF vs ABONO: the two conflicting aggregates settle with exactly
 *      one winner; the loser aborts on the fresh-read guard
 *      (WRITE_OFF_ALREADY_MSG / WRITE_OFF_PAID_MSG) and no invariant breaks.
 */
describe("R15 Fase 4 — optimistic concurrency (CAS via __v)", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const ACCOUNT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
  // Valid 24-hex ids for abonos pushed directly through the repository.
  const ABONO_ID = "111111111111111111111111";
  const MOV_ID = "222222222222222222222222";

  const creditReceivedInput = {
    counterparty: "Juan",
    principal: 100_000,
    currency: "COP" as const,
    accountId: ACCOUNT_ID,
    date: new Date("2025-06-01"),
  };

  const abonoInput = (amount: number) => ({
    amount,
    date: new Date("2025-06-02"),
    accountId: ACCOUNT_ID,
    currency: "COP" as const,
  });

  const creditGrantedInput = {
    counterparty: "Cliente",
    principal: 100_000,
    currency: "COP" as const,
    accountId: ACCOUNT_ID,
    date: new Date("2025-06-01"),
  };

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_cas"));
    await AccountModel.create({
      _id: ACCOUNT_ID,
      workspaceId: WS,
      name: "Cash",
      currency: "COP",
      isFixed: false,
    });
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await CreditReceivedModel.deleteMany({});
    await CreditGrantedModel.deleteMany({});
    await MovementModel.deleteMany({});
  });

  describe("CAS directo — repositorio con expectedVersion vencida", () => {
    it("rechaza una versión vencida con ConflictError(DEBT_MODIFIED_MSG) sin efectos", async () => {
      const credit = await createCreditReceived(
        WS,
        creditReceivedInput,
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      expect(credit.version).toBe(0);

      // 1er abono por use case → __v 0→1
      const result = await addAbonoReceived(
        WS,
        credit.id,
        abonoInput(30_000),
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      expect(result.version).toBe(1);

      // CAS stale directo (fuera de transacción, expectedVersion 0 → actual 1)
      const repo = new MongoCreditReceivedRepository();
      await expect(
        repo.addAbono(
          WS,
          credit.id,
          { id: ABONO_ID, amount: 30_000, date: new Date("2025-06-03"), accountId: ACCOUNT_ID, movementId: MOV_ID },
          undefined,
          0,
        ),
      ).rejects.toThrow(DEBT_MODIFIED_MSG);

      // Sin efecto: 1 abono, __v sin mover, ningún movement duplicado.
      const credits = await repo.findByWorkspaceId(WS);
      const after = credits.find(c => c.id === credit.id)!;
      expect(after.version).toBe(1);
      expect(after.abonos).toHaveLength(1);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(2); // principal + 1 abono

      // Con versión fresca → OK.
      await repo.addAbono(
        WS,
        credit.id,
        { id: ABONO_ID, amount: 30_000, date: new Date("2025-06-03"), accountId: ACCOUNT_ID, movementId: MOV_ID },
        undefined,
        after.version,
      );
      const credits2 = await repo.findByWorkspaceId(WS);
      const after2 = credits2.find(c => c.id === credit.id)!;
      expect(after2.version).toBe(2);
      expect(after2.abonos).toHaveLength(2);
    }, 30_000);

    it("idempotencia: reinsertar el mismo movementId es un no-op silencioso (sin bump ni duplicado)", async () => {
      const credit = await createCreditReceived(
        WS,
        creditReceivedInput,
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      const repo = new MongoCreditReceivedRepository();
      const abono = { id: ABONO_ID, amount: 30_000, date: new Date("2025-06-02"), accountId: ACCOUNT_ID, movementId: MOV_ID };

      await repo.addAbono(WS, credit.id, abono, undefined, 0); // v0 → v1
      const credits1 = await repo.findByWorkspaceId(WS);
      expect(credits1.find(c => c.id === credit.id)!.version).toBe(1);

      // Mismo movementId con versión fresca re-leída → guard absorbido.
      await repo.addAbono(WS, credit.id, abono, undefined, credits1.find(c => c.id === credit.id)!.version);

      const credits2 = await repo.findByWorkspaceId(WS);
      const after = credits2.find(c => c.id === credit.id)!;
      expect(after.version).toBe(1); // SIN bump
      expect(after.abonos).toHaveLength(1); // SIN duplicado
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1); // solo principal
    }, 30_000);
  });

  describe("concurrencia real — N abonos de 30_000 sobre 1 crédito de 100_000", () => {
    it.each([10, 50, 100])(
      "N=%i → exactamente 3 ganan; el resto falla por re-validación; __v == 3",
      async (n) => {
        const credit = await createCreditReceived(
          WS,
          creditReceivedInput,
          new MongoCreditReceivedRepository(),
          new MongoMovementRepository(),
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        );

        const settled = await Promise.allSettled(
          Array.from({ length: n }, () =>
            addAbonoReceived(
              WS,
              credit.id,
              abonoInput(30_000),
              new MongoCreditReceivedRepository(),
              new MongoMovementRepository(),
              objectIdGenerator,
              new MongoAccountRepository(),
              new MongoUnitOfWork(),
            ),
          ),
        );

        const winners = settled.filter(s => s.status === "fulfilled");
        const losers = settled.filter(s => s.status === "rejected");
        expect(winners).toHaveLength(3);
        expect(losers).toHaveLength(n - 3);
        for (const loser of losers) {
          expect(loser.reason).toBeInstanceOf(ConflictError);
        }

        const doc = await CreditReceivedModel.findById(credit.id);
        expect(doc!.__v).toBe(3);
        expect(doc!.abonos).toHaveLength(3);

        // Estado financiero consistente: pending real = 100_000 − 3×30_000.
        const finalCredits = await new MongoCreditReceivedRepository().findByWorkspaceId(WS);
        const after = finalCredits.find(c => c.id === credit.id)!;
        expect(after.pending).toBe(10_000);

        // Un movement por abono ganador + el principal.
        expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(4);
      },
      120_000,
    );
  });

  describe("write-off vs abono final — exactamente uno gana", () => {
    it("el perdedor aborta sobre el guard de re-lectura fresca (writtenOff/paid)", async () => {
      const credit = await createCreditGranted(
        WS,
        creditGrantedInput,
        new MongoCreditGrantedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      const abonoP = addAbonoGranted(
        WS,
        credit.id,
        abonoInput(100_000), // abono por el pending completo
        new MongoCreditGrantedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      const writeOffP = writeOffCreditGranted(
        WS,
        credit.id,
        new MongoCreditGrantedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      const [abonoRes, writeOffRes] = await Promise.allSettled([abonoP, writeOffP]);

      // Invariante central: NUNCA ambos ganan.
      expect([abonoRes.status, writeOffRes.status].filter(s => s === "fulfilled")).toHaveLength(1);

      if (abonoRes.status === "rejected") {
        expect((abonoRes.reason as Error).message).toBe(WRITE_OFF_ALREADY_MSG);
      } else {
        // abono ganó → el write-off DEBE haber perdido (invariante verificado arriba)
        if (writeOffRes.status !== "rejected") {
          throw new Error("invariant: write-off and final abono cannot both win");
        }
        expect((writeOffRes.reason as Error).message).toBe(WRITE_OFF_PAID_MSG);
      }

      const doc = await CreditGrantedModel.findById(credit.id);
      if (writeOffRes.status === "fulfilled") {
        // write-off ganó: deuda marcada, sin abonos, expense de baja sumado.
        expect(doc!.writtenOff).toBeDefined();
        expect(doc!.abonos).toHaveLength(0);
        expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(2); // principal + write-off
      } else {
        // abono ganó: deuda pagada en cero, abono registrado.
        expect(doc!.writtenOff).toBeUndefined();
        expect(doc!.abonos).toHaveLength(1);
        const finalCredits = await new MongoCreditGrantedRepository().findByWorkspaceId(WS);
        expect(finalCredits.find(c => c.id === credit.id)!.pending).toBe(0);
        expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(2); // principal + abono
      }
    }, 60_000);
  });
});