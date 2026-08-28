import { describe, it, expect } from "vitest";
import {
  buildLegacyRepairPlan,
  planSaleCreditRepairs,
  planOrphanCreditRepairs,
  planTransferMovementLinks,
  planRelinkOrDeleteMovements,
  planSoftDeletedSalePurges,
  type LegacySaleSnapshot,
  type LegacyCreditSnapshot,
  type LegacyTransferSnapshot,
  type LegacyTransferLegSnapshot,
  type LegacyStaleRefMovementSnapshot,
  type StaleParentResolver,
} from "./legacy-repair";

const sale = (overrides: Partial<LegacySaleSnapshot> = {}): LegacySaleSnapshot => ({
  id: "sale-1",
  userId: "user-1",
  paymentMode: "on-credit",
  total: 30000,
  abonosSum: 20000,
  accountId: "acc-1",
  date: new Date("2026-08-01T05:00:00.000Z"),
  ...overrides,
});

const credit = (overrides: Partial<LegacyCreditSnapshot> = {}): LegacyCreditSnapshot => ({
  id: "credit-1",
  accountId: "acc-1",
  date: new Date("2026-08-01T05:00:00.000Z"),
  principal: 30000,
  ...overrides,
});

const transfer = (overrides: Partial<LegacyTransferSnapshot> = {}): LegacyTransferSnapshot => ({
  id: "transfer-1",
  sourceAccountId: "acc-1",
  destinationAccountId: "acc-2",
  sourceAmount: 5000,
  destinationAmount: 4900,
  date: new Date("2026-08-02T05:00:00.000Z"),
  ...overrides,
});

const leg = (overrides: Partial<LegacyTransferLegSnapshot> = {}): LegacyTransferLegSnapshot => ({
  movementId: "mov-1",
  transferId: "transfer-1",
  type: "expense",
  ...overrides,
});

const staleMvt = (
  overrides: Partial<LegacyStaleRefMovementSnapshot> = {},
): LegacyStaleRefMovementSnapshot => ({
  id: "mvt-1",
  kind: "salePayment",
  refId: "00000000-0000-0000-0000-000000000000",
  accountId: "acc-1",
  date: new Date("2026-08-01T05:00:00.000Z"),
  amount: 10000,
  ...overrides,
});

describe("planSaleCreditRepairs", () => {
  it("creates a credit owning total - abonosSum when no credit exists", () => {
    const actions = planSaleCreditRepairs(
      [sale({ total: 30000, abonosSum: 20000 })],
      [],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "create_sale_credit",
      saleId: "sale-1",
      userId: "user-1",
      principal: 10000,
      accountId: "acc-1",
    });
  });

  it("creates a credit owning the full total when abonosSum is zero", () => {
    const actions = planSaleCreditRepairs(
      [sale({ total: 30000, abonosSum: 0 })],
      [],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "create_sale_credit",
      principal: 30000,
    });
  });

  it("never derives a negative principal (overpaid legacy sale)", () => {
    const actions = planSaleCreditRepairs(
      [sale({ total: 10000, abonosSum: 15000 })],
      [],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: "create_sale_credit", principal: 0 });
  });

  it("skips an on-credit sale already linked to a credit by saleId", () => {
    const actions = planSaleCreditRepairs(
      [sale({ id: "sale-1" })],
      [credit({ id: "credit-1", saleId: "sale-1" })],
    );

    expect(actions).toHaveLength(0);
  });

  it("links a single existing unlinked credit that matches by value", () => {
    const actions = planSaleCreditRepairs(
      [sale({ id: "sale-1", total: 30000, abonosSum: 0 })],
      [credit({ id: "cand-9", saleId: null, principal: 20000 })],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "link_sale_credit",
      creditId: "cand-9",
      saleId: "sale-1",
    });
  });

  it("links exactly one credit whose saleId is a stale UUID (no create)", () => {
    const actions = planSaleCreditRepairs(
      [sale({ id: "sale-1", total: 30000, abonosSum: 20000 })],
      [
        credit({
          id: "credit-stale",
          saleId: "d7384a95-91bc-4ab0-b28c-2f78b5e69979",
          accountId: "acc-1",
          principal: 10000,
        }),
      ],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "link_sale_credit",
      creditId: "credit-stale",
      saleId: "sale-1",
    });
  });

  it("does not treat a credit owned by another live sale as a candidate", () => {
    const actions = planSaleCreditRepairs(
      [
        sale({ id: "sale-1", accountId: "acc-1" }),
        sale({ id: "other-live-sale", accountId: "acc-2" }),
      ],
      [
        credit({
          id: "owned",
          saleId: "other-live-sale",
          accountId: "acc-2",
          principal: 20000,
        }),
      ],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "create_sale_credit",
      saleId: "sale-1",
      principal: 10000,
    });
  });

  it("skips when two candidate credits match (ambiguous)", () => {
    const actions = planSaleCreditRepairs(
      [sale({ id: "sale-1" })],
      [
        credit({ id: "c1", saleId: null, principal: 20000 }),
        credit({ id: "c2", saleId: null, principal: 20000 }),
      ],
    );

    expect(actions).toHaveLength(0);
  });

  it("skips soft-deleted sales", () => {
    const actions = planSaleCreditRepairs(
      [sale({ deletedAt: new Date("2026-08-10T05:00:00.000Z") })],
      [],
    );

    expect(actions).toHaveLength(0);
  });

  it("skips non on-credit sales", () => {
    const actions = planSaleCreditRepairs(
      [sale({ paymentMode: "paid-in-full" })],
      [],
    );

    expect(actions).toHaveLength(0);
  });
});

describe("planOrphanCreditRepairs", () => {
  it("skips a credit whose saleId matches a live sale id", () => {
    const actions = planOrphanCreditRepairs(
      [sale({ id: "sale-live" })],
      [credit({ id: "credit-ok", saleId: "sale-live" })],
    );

    expect(actions).toHaveLength(0);
  });

  it("emits nothing for a stale-UUID credit with one matching live sale (relinked by planSaleCreditRepairs)", () => {
    const actions = planOrphanCreditRepairs(
      [sale({ id: "sale-current", total: 30000, abonosSum: 0 })],
      [credit({ id: "credit-c", saleId: "OLD-UUID-1", principal: 30000 })],
    );

    expect(actions).toHaveLength(0);
  });

  it("deletes a true orphan credit when no live sale matches", () => {
    const actions = planOrphanCreditRepairs(
      [],
      [credit({ id: "credit-orphan", saleId: "gone-sale", principal: 5000 })],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "delete_orphan_credit",
      creditId: "credit-orphan",
      saleId: "gone-sale",
    });
  });

  it("skips ambiguous orphan credit with two matching sales", () => {
    const actions = planOrphanCreditRepairs(
      [
        sale({ id: "s-a", total: 30000, abonosSum: 0 }),
        sale({ id: "s-b", total: 30000, abonosSum: 0 }),
      ],
      [credit({ id: "credit-amb", saleId: "OLD-UUID-9", principal: 30000 })],
    );

    expect(actions).toHaveLength(0);
  });

  it("ignores standalone credits without saleId", () => {
    const actions = planOrphanCreditRepairs([], [credit({ saleId: undefined })]);

    expect(actions).toHaveLength(0);
  });
});

describe("planTransferMovementLinks", () => {
  it("links both legs when both are present and movementIds absent", () => {
    const actions = planTransferMovementLinks(
      [transfer()],
      [
        leg({ movementId: "mov-exp", type: "expense" }),
        leg({ movementId: "mov-inc", type: "income" }),
      ],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "link_transfer_movements",
      transferId: "transfer-1",
      expenseId: "mov-exp",
      incomeId: "mov-inc",
    });
    expect(actions[0].description).not.toContain("missing");
  });

  it("skips transfers that already persist both movementIds", () => {
    const actions = planTransferMovementLinks(
      [transfer({ movementIds: { expenseId: "e", incomeId: "i" } })],
      [],
    );

    expect(actions).toHaveLength(0);
  });

  it("links one leg and reports the missing one in the description", () => {
    const actions = planTransferMovementLinks(
      [transfer()],
      [leg({ movementId: "mov-inc", type: "income" })],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0].incomeId).toBe("mov-inc");
    expect(actions[0].expenseId).toBeUndefined();
    expect(actions[0].description).toContain("expense");
  });

  it("produces an action with neither id when no legs are found", () => {
    const actions = planTransferMovementLinks([transfer()], []);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "link_transfer_movements",
      transferId: "transfer-1",
    });
    expect(actions[0]).not.toHaveProperty("expenseId");
    expect(actions[0]).not.toHaveProperty("incomeId");
    expect(actions[0].description).toContain("missing movement leg(s)");
  });

  it("only fills missing-but-found legs, keeping existing fields untouched", () => {
    const actions = planTransferMovementLinks(
      [transfer({ movementIds: { expenseId: "e" } })],
      [leg({ movementId: "mov-inc", type: "income" })],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0].expenseId).toBeUndefined();
    expect(actions[0].incomeId).toBe("mov-inc");
  });
});

describe("planRelinkOrDeleteMovements", () => {
  it("relinks a salePayment with a unique parent", () => {
    const actions = planRelinkOrDeleteMovements([staleMvt()], {
      salePayment: () => ({ status: "unique", parentId: "sale-current" }),
      creditPrincipal: () => ({ status: "none" }),
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "relink_movement_ref_id",
      movementId: "mvt-1",
      movementKind: "salePayment",
      oldRefId: staleMvt().refId,
      newParentId: "sale-current",
    });
  });

  it("deletes a salePayment with no parent", () => {
    const actions = planRelinkOrDeleteMovements([staleMvt()], {
      salePayment: () => ({ status: "none" }),
      creditPrincipal: () => ({ status: "none" }),
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "delete_orphan_movement",
      movementId: "mvt-1",
      movementKind: "salePayment",
      refId: staleMvt().refId,
    });
  });

  it("skips ambiguous salePayment", () => {
    const actions = planRelinkOrDeleteMovements([staleMvt()], {
      salePayment: () => ({ status: "ambiguous" }),
      creditPrincipal: () => ({ status: "none" }),
    });

    expect(actions).toHaveLength(0);
  });

  it("relinks a creditGrantedPrincipal with a unique parent", () => {
    const mv = staleMvt({ kind: "creditGrantedPrincipal" });
    const actions = planRelinkOrDeleteMovements([mv], {
      salePayment: () => ({ status: "none" }),
      creditPrincipal: () => ({ status: "unique", parentId: "credit-par" }),
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "relink_movement_ref_id",
      movementKind: "creditGrantedPrincipal",
      newParentId: "credit-par",
    });
  });

  it("relinks a creditReceivedPrincipal with a unique parent", () => {
    const mv = staleMvt({ kind: "creditReceivedPrincipal" });
    const actions = planRelinkOrDeleteMovements([mv], {
      salePayment: () => ({ status: "none" }),
      creditPrincipal: () => ({ status: "unique", parentId: "credit-par" }),
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "relink_movement_ref_id",
      movementKind: "creditReceivedPrincipal",
      newParentId: "credit-par",
    });
  });

  it("deletes a creditGrantedPrincipal with no parent", () => {
    const mv = staleMvt({ kind: "creditGrantedPrincipal" });
    const actions = planRelinkOrDeleteMovements([mv], {
      salePayment: () => ({ status: "none" }),
      creditPrincipal: () => ({ status: "none" }),
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "delete_orphan_movement",
      movementKind: "creditGrantedPrincipal",
    });
  });

  it("deletes unknown kinds defensively", () => {
    const mv = staleMvt({ kind: "somethingElse" as LegacyStaleRefMovementSnapshot["kind"] });
    const actions = planRelinkOrDeleteMovements([mv], {
      salePayment: () => ({ status: "unique", parentId: "x" }),
      creditPrincipal: () => ({ status: "unique", parentId: "y" }),
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: "delete_orphan_movement" });
  });

  it("always deletes a transfer-kind orphan movement", () => {
    const mv = staleMvt({ kind: "transfer" });
    const actions = planRelinkOrDeleteMovements([mv], {
      salePayment: () => ({ status: "unique", parentId: "x" }),
      creditPrincipal: () => ({ status: "unique", parentId: "y" }),
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "delete_orphan_movement",
      movementKind: "transfer",
      movementId: "mvt-1",
      refId: mv.refId,
    });
  });
});

describe("planSoftDeletedSalePurges", () => {
  it("flags only sales carrying the soft-delete vestige", () => {
    const actions = planSoftDeletedSalePurges([
      sale({ deletedAt: new Date("2026-08-10T05:00:00.000Z") }),
      sale({ id: "alive" }),
    ]);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "purge_soft_deleted_sale",
      saleId: "sale-1",
    });
  });
});

describe("buildLegacyRepairPlan", () => {
  it("combines all detection passes in stable order", () => {
    const plan = buildLegacyRepairPlan(
      // s-create: on-credit, no candidate credit → create (account differs so
      // the stale-UUID credit below cannot claim it).
      // s-link: on-credit, total == the stale-UUID credit principal → link.
      // s-purge: soft-deleted → purge.
      [
        sale({ id: "s-create", total: 30000, abonosSum: 10000, accountId: "acc-2" }),
        sale({ id: "s-link", total: 20000, abonosSum: 0, accountId: "acc-1" }),
        sale({ id: "s-purge", deletedAt: new Date("2026-08-10T05:00:00.000Z") }),
      ],
      // one stale-UUID credit that gets linked, not orphaned
      [credit({ id: "c-relink", saleId: "OLD-UUID-1", principal: 20000 })],
      // one transfer missing movementIds
      [transfer({ id: "t-1" })],
      // its two legs
      [
        leg({ movementId: "m-exp", transferId: "t-1", type: "expense" }),
        leg({ movementId: "m-inc", transferId: "t-1", type: "income" }),
      ],
      // one stale movement that relinks
      [
        staleMvt({
          id: "m-stale",
          kind: "salePayment",
          refId: "OLD-UUID-M",
          amount: 20000,
        }),
      ],
      {
        salePayment: () => ({ status: "unique", parentId: "s-matching" }),
        creditPrincipal: () => ({ status: "none" }),
      },
    );

    const types = plan.map((a) => a.type);
    // order: create/link credits → orphan → transfers → relinks/deletes → purges
    expect(types).toEqual([
      "create_sale_credit",
      "link_sale_credit",
      "link_transfer_movements",
      "relink_movement_ref_id",
      "purge_soft_deleted_sale",
    ]);
  });
});
