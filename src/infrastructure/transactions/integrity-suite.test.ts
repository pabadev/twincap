import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ConflictError, NotFoundError, DEBT_MODIFIED_MSG } from "../../core/domain/errors";
import { exponentOf, type Currency } from "../../core/domain/currency";
import { OPENING_CATEGORY_ID } from "../../core/domain/synthetic-categories";
import { createCreditReceived } from "../../core/application/credits-received/create-credit-received";
import { addAbono as addAbonoReceived } from "../../core/application/credits-received/add-abono";
import { createCreditGranted } from "../../core/application/credits-granted/create-credit-granted";
import { addAbono as addAbonoGranted } from "../../core/application/credits-granted/add-abono";
import { writeOffCreditGranted, WRITE_OFF_ALREADY_MSG } from "../../core/application/credits-granted/write-off-credit-granted";
import { createSale } from "../../core/application/sales/create-sale";
import { deleteSale } from "../../core/application/sales/delete-sale";
import { createTransfer } from "../../core/application/transfers/create-transfer";
import { MongoCreditReceivedRepository } from "../repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../repositories/credit-granted-repository";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { MongoSaleRepository } from "../repositories/sale-repository";
import { MongoCatalogItemRepository } from "../repositories/catalog-repository";
import { MongoClientRepository } from "../repositories/client-repository";
import { MongoTransferRepository } from "../repositories/transfer-repository";
import { objectIdGenerator } from "../config/id-generator";
import { MongoUnitOfWork } from "./mongo-unit-of-work";
import { AccountModel } from "../models/account";
import { CreditReceivedModel } from "../models/credit-received";
import { CreditGrantedModel } from "../models/credit-granted";
import { MovementModel } from "../models/movement";
import { SaleModel } from "../models/sale";
import { CatalogItemModel } from "../models/catalog";
import { ClientModel } from "../models/client";
import { TransferModel } from "../models/transfer";

/**
 * R15 Fase 7 — Integrity suite (§25, §14).
 *
 * REAL repositories + REAL MongoUnitOfWork + REAL use cases against a shared
 * single-node MongoMemoryReplSet (binary PINNED to 7.0.41 — same reason as the
 * F2/F4/F6 suites: latest mongod crashes on Windows).
 *
 * What this suite proves (each invariant ADDS to, never duplicates, the F2
 * rollback, F4 CAS and F6 deleteSale suites):
 *
 *   1. WRITE-OFF CONCURRENCY (N=10/50/100 over the SAME debt): exactly one
 *      write-off wins, the rest are rejected with ConflictError, EXACTLY ONE
 *      expense movement exists and the credit version moved once (`__v == 1`).
 *   2. DELETE-SALE CONCURRENCY (N=100): exactly one delete wins (F6 already
 *      covers N=10/25/50), the rest NotFoundError, stock restored EXACTLY once.
 *   3. OVERPAY INVARIANT: N concurrent abonos exceeding the principal converge
 *      to exactly floor(P/abono) winners and stored pending NEVER goes negative.
 *   4. TRANSFER NET-ZERO (same-currency): Σ signedAmount of both legs == 0.
 *   5. TRANSFER NET-ZERO (cross-currency): every leg mirrors the transfer
 *      amounts EXACTLY and source/destination satisfy the documented FX
 *      formula (`destinationAmount_minor == sourceAmount_minor × rate ×
 *      10^(destExp − srcExp)`); per-account ledgers stay coherent.
 *      NOTE: inconsistent rates are NOT rejected here — the production gap
 *      (§9f) is out of scope for this round; the suite only verifies the
 *      invariant with consistent values.
 *   6. SALE TOTAL INVARIANT: for an on-credit sale the linked CreditGranted
 *      principal == sale.total, `credit.pending === total − Σ credit abonos`,
 *      and the movements (initial payment + later abonos) all reference the
 *      credit (kind creditGrantedAbono, context Business).
 *   7. INVENTORY INVARIANT: stock_final == stock_inicial − Σ quantities of
 *      ACTIVE sales + quantities restored by deletions; soft-deleted sales
 *      (deletedAt) never count as active.
 *   8. REAL ROLLBACK — write-off FAIL_STEP: when the FINAL write (the credit
 *      write-off marker) fails mid-transaction, the already-created expense
 *      movement rolls back with it (atomicity, not compensation).
 */

type VersionedDoc = { __v?: number };

function versionOf(doc: unknown): number | undefined {
  return (doc as VersionedDoc).__v;
}

/** Σ abono amounts (minor units) of a stored debt document. */
function abonosTotal(abonos: ReadonlyArray<{ amount: number }>): number {
  return abonos.reduce((acc, a) => acc + a.amount, 0);
}

function expectedFxDestinationMinor(
  sourceMinor: number,
  rate: number,
  sourceCurrency: Currency,
  destinationCurrency: Currency,
): number {
  // Documented formula (§9f verification): rate is quoted as "destination
  // currency units per 1 source currency unit". Match on integer minors:
  // dest_minor == src_minor × rate × 10^(destExp − srcExp).
  return Math.round(sourceMinor * rate * 10 ** (exponentOf(destinationCurrency) - exponentOf(sourceCurrency)));
}

describe("R15 Fase 7 — integrity suite (§25/§14)", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const ACCOUNT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb"; // COP source (Cash)
  const ACCOUNT_ID_2 = "ffffffffffffffffffffffff"; // COP destination
  const ACCOUNT_USD = "eeeeeeeeeeeeeeeeeeeeeeee"; // USD source
  const CAT_A = "ccccccccccccccccccccccc1"; // product 5000 COP
  const CAT_B = "ccccccccccccccccccccccc2"; // product 3000 COP
  const CLIENT_ID = "dddddddddddddddddddddddd";
  const SALE_ID = "999999999999999999999999"; // delete-sale fixture
  const CREDIT_ID = "888888888888888888888888"; // delete-sale fixture
  const SOFT_SALE_ID = "777777777777777777777777"; // soft-deleted sale fixture

  const date = new Date("2025-06-01");

  const creditGrantedInput = {
    counterparty: "Cliente",
    principal: 100_000,
    currency: "COP" as const,
    accountId: ACCOUNT_ID,
    date,
  };

  const abonoInput = (amount: number) => ({
    amount,
    date: new Date("2025-06-02"),
    accountId: ACCOUNT_ID,
    currency: "COP" as const,
  });

  /** Σ signedAmount of the movements matching a filter (query filters cast, unlike aggregate $match). */
  async function signedAmountTotal(filter: Record<string, unknown>): Promise<number> {
    const movements = await MovementModel.find(filter);
    return movements.reduce((acc, m) => acc + m.signedAmount, 0);
  }

  async function seedCashAccount() {
    await AccountModel.create({
      _id: ACCOUNT_ID,
      workspaceId: WS,
      name: "Cash",
      currency: "COP",
      isFixed: false,
    });
  }

  async function seedUsdAccount() {
    await AccountModel.create({
      _id: ACCOUNT_USD,
      workspaceId: WS,
      name: "Cash USD",
      currency: "USD",
      isFixed: false,
    });
  }

  /** Opening income that gives the source account its starting balance. */
  async function seedOpeningBalance(accountId: string, amountMinor: number) {
    await MovementModel.create({
      workspaceId: WS,
      accountId,
      type: "income",
      amount: amountMinor,
      signedAmount: amountMinor,
      date,
      categoryId: OPENING_CATEGORY_ID,
      link: { kind: "opening", refId: accountId, opId: objectIdGenerator.generate() },
    });
  }

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_integrity"));
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await AccountModel.deleteMany({});
    await CreditReceivedModel.deleteMany({});
    await CreditGrantedModel.deleteMany({});
    await MovementModel.deleteMany({});
    await SaleModel.deleteMany({});
    await CatalogItemModel.deleteMany({});
    await ClientModel.deleteMany({});
    await TransferModel.deleteMany({});
    await seedCashAccount();
  });

  describe("write-off concurrency — N=10/50/100 over the SAME debt", () => {
    it.each([10, 50, 100])(
      "N=%i concurrent write-offs → exactly 1 wins, ONE expense movement, __v == 1",
      async (n) => {
        const credit = await createCreditGranted(
          WS,
          creditGrantedInput,
          new MongoCreditGrantedRepository(),
          new MongoMovementRepository(),
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        );
        expect(credit.version).toBe(0);

        const settled = await Promise.allSettled(
          Array.from({ length: n }, () =>
            writeOffCreditGranted(
              WS,
              credit.id,
              new MongoCreditGrantedRepository(),
              new MongoMovementRepository(),
              objectIdGenerator,
              new MongoUnitOfWork(),
            ),
          ),
        );

        const winners = settled.filter((s) => s.status === "fulfilled");
        const losers = settled.filter((s) => s.status === "rejected");
        expect(winners.length).toBe(1);
        expect(losers.length).toBe(n - 1);
        for (const loser of losers) {
          expect(loser.reason).toBeInstanceOf(ConflictError);
          expect(
            [WRITE_OFF_ALREADY_MSG, DEBT_MODIFIED_MSG].includes(
              (loser.reason as Error).message,
            ),
          ).toBe(true);
        }

        // Exactly ONE expense movement (kind creditGrantedWriteOff) and the
        // credit walked its version exactly once.
        const doc = await CreditGrantedModel.findById(credit.id);
        expect(versionOf(doc)).toBe(1);
        expect(doc!.writtenOff).toBeDefined();
        expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(2); // principal + write-off
        const writeOffs = await MovementModel.find({
          workspaceId: WS,
          "link.kind": "creditGrantedWriteOff",
        });
        expect(writeOffs).toHaveLength(1);
        expect(writeOffs[0].type).toBe("expense");
        expect(writeOffs[0].signedAmount).toBe(-100_000);
        expect(writeOffs[0].context).toBe("Personal");
        expect(writeOffs[0].link.refId).toBe(credit.id);
      },
      120_000,
    );
  });

  describe("delete-sale concurrency — N=100 (F6 covers N=10/25/50)", () => {
    async function seedSaleWithCredit() {
      await CatalogItemModel.create({
        _id: CAT_A,
        workspaceId: WS,
        name: "Pan",
        unitPrice: 5000,
        currency: "COP",
        type: "product",
        stock: 5,
      });
      await SaleModel.create({
        _id: SALE_ID,
        workspaceId: WS,
        items: [{ itemId: CAT_A, quantity: 2, unitPrice: 5000, subtotal: 10000 }],
        date: new Date("2025-06-01"),
        paymentMode: "on-credit",
        accountId: ACCOUNT_ID,
        total: 10000,
        abonos: [],
        stockRestored: false,
      });
      await CreditGrantedModel.create({
        _id: CREDIT_ID,
        workspaceId: WS,
        counterparty: "Juan Pérez",
        principal: 10000,
        accountId: ACCOUNT_ID,
        date: new Date("2025-06-01"),
        saleId: SALE_ID,
        abonos: [],
      });
      await MovementModel.create([
        {
          workspaceId: WS,
          accountId: ACCOUNT_ID,
          type: "income",
          amount: 10000,
          signedAmount: 10000,
          date: new Date("2025-06-01"),
          categoryId: ACCOUNT_ID,
          link: { kind: "salePayment", refId: SALE_ID, opId: objectIdGenerator.generate() },
        },
        {
          workspaceId: WS,
          accountId: ACCOUNT_ID,
          type: "income",
          amount: 2000,
          signedAmount: 2000,
          date: new Date("2025-06-02"),
          categoryId: ACCOUNT_ID,
          link: { kind: "creditGrantedAbono", refId: CREDIT_ID, opId: objectIdGenerator.generate() },
        },
      ]);
    }

    it("N=100 concurrent duplicate deletes → exactly 1 wins, stock restored EXACTLY once", async () => {
      await seedSaleWithCredit();

      const settled = await Promise.allSettled(
        Array.from({ length: 100 }, () =>
          deleteSale(
            WS,
            SALE_ID,
            new MongoSaleRepository(),
            new MongoCatalogItemRepository(),
            new MongoMovementRepository(),
            new MongoCreditGrantedRepository(),
            new MongoUnitOfWork(),
          ),
        ),
      );

      const winners = settled.filter((s) => s.status === "fulfilled");
      const losers = settled.filter((s) => s.status === "rejected");
      expect(winners.length).toBe(1);
      expect(losers.length).toBe(99);
      for (const loser of losers) {
        expect(loser.reason).toBeInstanceOf(NotFoundError);
      }

      const item = await CatalogItemModel.findById(CAT_A);
      expect(item!.stock).toBe(7); // 5 → restored exactly once
      expect(await SaleModel.countDocuments({ workspaceId: WS })).toBe(0);
      expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(0);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
    }, 120_000);
  });

  describe("overpay invariant — pending never negative", () => {
    it.each([10, 50, 100])(
      "N=%i concurrent abonos exceeding principal → exactly floor(P/abono) winners, pending >= 0",
      async (n) => {
        // P = 120_000, abono = 50_000 → 2 rows fit (3 would need 150_000).
        const credit = await createCreditReceived(
          WS,
          { counterparty: "Juan", principal: 120_000, currency: "COP", accountId: ACCOUNT_ID, date },
          new MongoCreditReceivedRepository(),
          new MongoMovementRepository(),
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        );
        expect(credit.version).toBe(0);

        const settled = await Promise.allSettled(
          Array.from({ length: n }, () =>
            addAbonoReceived(
              WS,
              credit.id,
              abonoInput(50_000),
              new MongoCreditReceivedRepository(),
              new MongoMovementRepository(),
              objectIdGenerator,
              new MongoAccountRepository(),
              new MongoUnitOfWork(),
            ),
          ),
        );

        const winners = settled.filter((s) => s.status === "fulfilled");
        const losers = settled.filter((s) => s.status === "rejected");
        expect(winners.length).toBe(Math.floor(120_000 / 50_000)); // 2
        expect(losers.length).toBe(n - 2);
        for (const loser of losers) {
          expect(loser.reason).toBeInstanceOf(ConflictError);
        }

        // Invariant: pending == principal − Σ abonos >= 0 for EVERY stored credit.
        const docs = await CreditReceivedModel.find({ workspaceId: WS });
        for (const doc of docs) {
          expect(doc.principal - abonosTotal(doc.abonos)).toBeGreaterThanOrEqual(0);
        }

        const doc = await CreditReceivedModel.findById(credit.id);
        expect(doc!.abonos).toHaveLength(2);
        expect(versionOf(doc)).toBe(2);
        expect(doc!.principal - abonosTotal(doc!.abonos)).toBe(20_000);
        // 1 principal movement + exactly 2 abono movements referencing the credit.
        expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(3);
        expect(
          await MovementModel.countDocuments({
            workspaceId: WS,
            "link.kind": "creditReceivedAbono",
            "link.refId": credit.id,
          }),
        ).toBe(2);
      },
      120_000,
    );
  });

  describe("transfer net-zero invariant (same-currency)", () => {
    it("Σ signedAmount of both legs == 0 and per-account ledgers stay coherent", async () => {
      await AccountModel.create({
        _id: ACCOUNT_ID_2,
        workspaceId: WS,
        name: "Target",
        currency: "COP",
        isFixed: false,
      });
      await seedOpeningBalance(ACCOUNT_ID, 500_000);

      const amounts = [40_000, 60_000, 100_000];
      const transferIds: string[] = [];
      for (const amount of amounts) {
        const transfer = await createTransfer(
          WS,
          {
            sourceAccountId: ACCOUNT_ID,
            sourceAmount: amount,
            destinationAccountId: ACCOUNT_ID_2,
            sourceCurrency: "COP",
            date,
            note: `transfer ${amount}`,
          },
          new MongoTransferRepository(),
          new MongoMovementRepository(),
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        );
        transferIds.push(transfer.id);
      }

      // Per transfer: the two legs cancel out exactly (one −, one +).
      for (const transferId of transferIds) {
        const legs = await MovementModel.find({
          workspaceId: WS,
          "link.kind": "transfer",
          "link.refId": transferId,
        });
        expect(legs).toHaveLength(2);
        const signedTotal = legs.reduce((acc, leg) => acc + leg.signedAmount, 0);
        expect(signedTotal).toBe(0);
        const sourceLeg = legs.find((leg) => String(leg.accountId) === ACCOUNT_ID)!;
        const destLeg = legs.find((leg) => String(leg.accountId) === ACCOUNT_ID_2)!;
        expect(sourceLeg.type).toBe("expense");
        expect(destLeg.type).toBe("income");
        expect(sourceLeg.signedAmount).toBe(-destLeg.signedAmount);
      }

      // Per-account ledger: sources lost exactly Σ transfers, destination gained it.
      expect(
        await signedAmountTotal({
          workspaceId: WS,
          accountId: ACCOUNT_ID,
          "link.kind": "transfer",
        }),
      ).toBe(-200_000);
      expect(
        await signedAmountTotal({
          workspaceId: WS,
          accountId: ACCOUNT_ID_2,
          "link.kind": "transfer",
        }),
      ).toBe(200_000);

      // Whole-account balances: 500_000 − 200_000 == 300_000 on the source.
      expect(await signedAmountTotal({ workspaceId: WS, accountId: ACCOUNT_ID })).toBe(300_000);

      // Transfer docs mirror the leg amounts.
      const transferDocs = await TransferModel.find({ workspaceId: WS });
      expect(transferDocs).toHaveLength(3);
      for (const t of transferDocs) {
        expect(t.destinationAmount).toBe(t.sourceAmount);
        expect(t.sourceCurrency).toBe("COP");
        expect(t.destinationCurrency).toBe("COP");
      }
    }, 60_000);
  });

  describe("transfer net-zero invariant (cross-currency, FX coherente)", () => {
    it("legs mirror source/destination EXACTLY and satisfy the documented FX formula", async () => {
      await seedUsdAccount();
      await seedOpeningBalance(ACCOUNT_USD, 500_000); // 5_000.00 USD in minor units

      // USD (exp 2) → COP (exp 0): dest_minor == src_minor × rate / 100.
      const fxCases = [
        { srcMinor: 10_000, rate: 4000, destMinor: 400_000 }, // 100.00 USD @ 4000
        { srcMinor: 20_000, rate: 5000, destMinor: 1_000_000 }, // 200.00 USD @ 5000
      ];

      const transferIds: string[] = [];
      for (const fx of fxCases) {
        // Formula cross-check BEFORE calling the use case (production never
        // recomputes it — §9f gap; we verify the invariant with consistent values).
        expect(
          expectedFxDestinationMinor(fx.srcMinor, fx.rate, "USD", "COP"),
        ).toBe(fx.destMinor);

        const transfer = await createTransfer(
          WS,
          {
            sourceAccountId: ACCOUNT_USD,
            sourceAmount: fx.srcMinor,
            destinationAccountId: ACCOUNT_ID,
            destinationAmount: fx.destMinor,
            destinationCurrency: "COP",
            sourceCurrency: "USD",
            rate: fx.rate,
            date,
            note: `fx transfer rate ${fx.rate}`,
          },
          new MongoTransferRepository(),
          new MongoMovementRepository(),
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        );
        transferIds.push(transfer.id);
      }

      for (let i = 0; i < fxCases.length; i++) {
        const fx = fxCases[i];
        const legs = await MovementModel.find({
          workspaceId: WS,
          "link.kind": "transfer",
          "link.refId": transferIds[i],
        });
        expect(legs).toHaveLength(2);

        const sourceLeg = legs.find((leg) => String(leg.accountId) === ACCOUNT_USD)!;
        const destLeg = legs.find((leg) => String(leg.accountId) === ACCOUNT_ID)!;
        // Source leg is −sourceAmount minor on the USD account (its currency
        // is implicit via the account; the transfer doc stores the currencies)...
        expect(sourceLeg.signedAmount).toBe(-fx.srcMinor);
        // ...destination leg is +destinationAmount minor on the COP account.
        expect(destLeg.signedAmount).toBe(fx.destMinor);

        // Transfer doc stores exactly the input numbers.
        const transferDoc = await TransferModel.findOne({ _id: transferIds[i] });
        expect(transferDoc!.sourceAmount).toBe(fx.srcMinor);
        expect(transferDoc!.destinationAmount).toBe(fx.destMinor);
        expect(transferDoc!.rate).toBe(fx.rate);
      }

      // Per-account ledger coherence in each currency's minors.
      expect(
        await signedAmountTotal({
          workspaceId: WS,
          accountId: ACCOUNT_USD,
          "link.kind": "transfer",
        }),
      ).toBe(-30_000); // −100.00 − 200.00 USD
      expect(await signedAmountTotal({ workspaceId: WS, accountId: ACCOUNT_USD })).toBe(470_000);
      expect(
        await signedAmountTotal({
          workspaceId: WS,
          accountId: ACCOUNT_ID,
          "link.kind": "transfer",
        }),
      ).toBe(1_400_000); // 400_000 + 1_000_000 COP
    }, 60_000);
  });

  describe("sale total = movements + credit state invariant", () => {
    it("on-credit sale: principal == total, pending == total − Σ abonos, all abono movements reference the credit", async () => {
      await CatalogItemModel.create({
        _id: CAT_A,
        workspaceId: WS,
        name: "Pan",
        unitPrice: 5000,
        currency: "COP",
        type: "product",
        stock: 10,
      });
      await CatalogItemModel.create({
        _id: CAT_B,
        workspaceId: WS,
        name: "Leche",
        unitPrice: 3000,
        currency: "COP",
        type: "product",
        stock: 5,
      });
      await ClientModel.create({
        _id: CLIENT_ID,
        workspaceId: WS,
        name: "Cliente Test",
        phone: "",
        email: "",
        note: "",
      });

      const uow = new MongoUnitOfWork();
      const sale = await createSale(
        WS,
        {
          items: [
            { itemId: CAT_A, quantity: 2, unitPrice: 5000 }, // 10_000
            { itemId: CAT_B, quantity: 1, unitPrice: 3000 }, // 3_000
          ],
          accountId: ACCOUNT_ID,
          clientId: CLIENT_ID,
          date,
          paymentMode: "on-credit",
          currency: "COP",
          initialPayment: 3_000,
        },
        new MongoSaleRepository(),
        new MongoCatalogItemRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoClientRepository(),
        new MongoCreditGrantedRepository(),
        new MongoAccountRepository(),
        uow,
      );
      expect(sale.total).toBe(13_000);

      // Sale doc: total, NO sales-side abonos, stock decremented on both items.
      const saleDoc = await SaleModel.findById(sale.id);
      expect(saleDoc!.total).toBe(13_000);
      expect(saleDoc!.paymentMode).toBe("on-credit");
      expect(saleDoc!.abonos).toHaveLength(0);
      expect((await CatalogItemModel.findById(CAT_A))!.stock).toBe(8);
      expect((await CatalogItemModel.findById(CAT_B))!.stock).toBe(4);

      // Linked credit: principal == FULL total (not total − initialPayment),
      // pending == principal − Σ abonos (the initial payment IS the first abono).
      const creditDoc = await CreditGrantedModel.findOne({ saleId: sale.id });
      expect(creditDoc).not.toBeNull();
      expect(creditDoc!.principal).toBe(13_000);
      expect(creditDoc!.counterparty).toBe("Cliente Test");
      expect(creditDoc!.abonos).toHaveLength(1);
      expect(creditDoc!.abonos[0].amount).toBe(3_000);
      expect(versionOf(creditDoc)).toBe(0);
      const pending = creditDoc!.principal - abonosTotal(creditDoc!.abonos);
      expect(pending).toBe(10_000); // == total − Σ abonos

      // Movements: ONE, the initial-payment abono, referencing the CREDIT
      // (refId == creditId, saleId traces to the sale), context Business.
      const movements = await MovementModel.find({ workspaceId: WS });
      expect(movements).toHaveLength(1);
      expect(movements[0].link.kind).toBe("creditGrantedAbono");
      expect(movements[0].link.refId).toBe(creditDoc!._id.toString());
      expect(movements[0].link.saleId).toBe(sale.id);
      expect(movements[0].signedAmount).toBe(3_000);
      expect(movements[0].context).toBe("Business");
      expect(
        await MovementModel.countDocuments({ workspaceId: WS, "link.kind": "salePayment" }),
      ).toBe(0);

      // Later abono via the credits-granted flow (sale-born branch) — the
      // invariant holds after the credit evolves: pending == total − Σ abonos.
      await addAbonoGranted(
        WS,
        creditDoc!._id.toString(),
        { amount: 4_000, date: new Date("2025-06-10"), accountId: ACCOUNT_ID, currency: "COP" },
        new MongoCreditGrantedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      const creditAfter = await CreditGrantedModel.findById(creditDoc!._id);
      expect(versionOf(creditAfter)).toBe(1);
      expect(creditAfter!.abonos).toHaveLength(2);
      expect(
        creditAfter!.principal - abonosTotal(creditAfter!.abonos),
      ).toBe(13_000 - 7_000);

      // Σ credit-abono movements == Σ abonos == 7_000, all Business, all
      // referencing the credit; the sale document itself never gains abonos.
      const abonoMovements = await MovementModel.find({
        workspaceId: WS,
        "link.kind": "creditGrantedAbono",
        "link.refId": creditDoc!._id.toString(),
      });
      expect(abonoMovements).toHaveLength(2);
      const totalAbonoMovements = abonoMovements.reduce((acc, m) => acc + m.signedAmount, 0);
      expect(totalAbonoMovements).toBe(7_000);
      for (const m of abonoMovements) {
        expect(m.context).toBe("Business");
        expect(m.link.saleId).toBe(sale.id);
      }
      const saleAfter = await SaleModel.findById(sale.id);
      expect(saleAfter!.abonos).toHaveLength(0);
      expect(saleAfter!.total).toBe(13_000);
    }, 60_000);
  });

  describe("inventory invariant — stock final == inicial − ventas activas + eliminaciones", () => {
    it("paid-in-full sales decrement, deleteSale restores exactly once, soft-deleted sales never count as active", async () => {
      await CatalogItemModel.create({
        _id: CAT_A,
        workspaceId: WS,
        name: "Pan",
        unitPrice: 5000,
        currency: "COP",
        type: "product",
        stock: 10,
      });
      await CatalogItemModel.create({
        _id: CAT_B,
        workspaceId: WS,
        name: "Leche",
        unitPrice: 3000,
        currency: "COP",
        type: "product",
        stock: 5,
      });

      const uow = new MongoUnitOfWork();
      const sale1 = await createSale(
        WS,
        {
          items: [
            { itemId: CAT_A, quantity: 2, unitPrice: 5000 },
            { itemId: CAT_B, quantity: 1, unitPrice: 3000 },
          ],
          accountId: ACCOUNT_ID,
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
        uow,
      );
      await createSale(
        WS,
        {
          items: [{ itemId: CAT_A, quantity: 3, unitPrice: 5000 }],
          accountId: ACCOUNT_ID,
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
        uow,
      );

      // Soft-deleted sale (legacy lifecycle: creation already decremented and
      // its stock was restored) — present in the DB but NEVER active.
      await SaleModel.create({
        _id: SOFT_SALE_ID,
        workspaceId: WS,
        items: [
          { itemId: CAT_A, quantity: 1, unitPrice: 5000, subtotal: 5000 },
          { itemId: CAT_B, quantity: 2, unitPrice: 3000, subtotal: 6000 },
        ],
        date,
        paymentMode: "paid-in-full",
        accountId: ACCOUNT_ID,
        total: 11_000,
        abonos: [],
        deletedAt: new Date("2025-06-02"),
        stockRestored: true,
      });

      // Intermediate invariant (before any deletion): active sales = sale1 + sale2
      // (the soft-deleted one is EXCLUDED), so stock == inicial − Σ activas.
      const activeBefore = await SaleModel.countDocuments({
        workspaceId: WS,
        deletedAt: { $exists: false },
      });
      expect(activeBefore).toBe(2);
      expect((await CatalogItemModel.findById(CAT_A))!.stock).toBe(5); // 10 − 2 − 3
      expect((await CatalogItemModel.findById(CAT_B))!.stock).toBe(4); // 5 − 1
      const storedBefore = await SaleModel.countDocuments({ workspaceId: WS });
      expect(storedBefore).toBe(3); // sale1 + sale2 + soft-deleted

      // Delete sale1 → its full quantity set is returned to stock EXACTLY once.
      await deleteSale(
        WS,
        sale1.id,
        new MongoSaleRepository(),
        new MongoCatalogItemRepository(),
        new MongoMovementRepository(),
        new MongoCreditGrantedRepository(),
        new MongoUnitOfWork(),
      );

      // stock_final == stock_inicial − Σ quantities of ACTIVE sales (only sale2
      // remains) == 10 − 3 and 5 − 0; the eliminated sale returned +2/+1.
      expect((await CatalogItemModel.findById(CAT_A))!.stock).toBe(7);
      expect((await CatalogItemModel.findById(CAT_B))!.stock).toBe(5);
      const activeAfter = await SaleModel.countDocuments({
        workspaceId: WS,
        deletedAt: { $exists: false },
      });
      expect(activeAfter).toBe(1); // sale2 only — soft-deleted never counts
      // sale1's movements are gone; only sale2's salePayment movement remains.
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    }, 60_000);
  });

  describe("rollback real write-off — FAIL_STEP", () => {
    it("when the FINAL write-off marker write fails, the expense movement rolls back with it", async () => {
      const credit = await createCreditGranted(
        WS,
        creditGrantedInput,
        new MongoCreditGrantedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);

      // Inject the failure on the LAST write of the transaction: the credit
      // write-off marker (CAS). The already-created expense movement must NOT
      // survive — real rollback, not compensation.
      const creditRepo = new MongoCreditGrantedRepository();
      vi.spyOn(creditRepo, "markWrittenOff").mockImplementationOnce(async () => {
        throw new Error("boom: write-off marker write fails");
      });

      await expect(
        writeOffCreditGranted(
          WS,
          credit.id,
          creditRepo,
          new MongoMovementRepository(),
          objectIdGenerator,
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: write-off marker write fails");

      // DB final == DB inicial: credit untouched (no marker, __v 0), and NOT a
      // single write-off expense movement survived.
      const doc = await CreditGrantedModel.findById(credit.id);
      expect(versionOf(doc)).toBe(0);
      expect(doc!.writtenOff).toBeUndefined();
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
      const remaining = await MovementModel.find({ workspaceId: WS });
      expect(remaining[0].link.kind).toBe("creditGrantedPrincipal");
      expect(
        await MovementModel.countDocuments({ workspaceId: WS, "link.kind": "creditGrantedWriteOff" }),
      ).toBe(0);
    }, 60_000);
  });
});