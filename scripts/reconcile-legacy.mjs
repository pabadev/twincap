/**
 * R5-F legacy data repair (design R5.4b Fase F).
 *
 * Repairs the five legacy problems detected by the R5 audit:
 *   1. On-credit sales without a linked CreditGranted (R5-D0) — creates a
 *      credit owning the CURRENT pending (total − Σ embedded abonos), or
 *      links an existing unlinked credit that matches by value.
 *   2. CreditGranted records with a stale UUID saleId — relinks them to the
 *      current sale ObjectId when a live sale matches by value; deletes only
 *      TRUE orphans (sale gone AND nothing matches).
 *   3. Transfers without persisted movementIds (R5-B) — links the two
 *      transfer movement legs, locating them BY VALUE (account/date/amount),
 *      not by stored refId, and relinks the stored refId to the transfer id.
 *   4. Movements whose link.refId points to an OLD UUID — relinks to the
 *      current parent ObjectId, or deletes them when the parent is gone.
 *   5. Sales carrying the old soft-delete vestige (deletedAt) — purges them
 *      through the sale cascade (stock restore, movements, linked credit).
 *
 * The plan is derived by the pure module `src/lib/legacy-repair.ts`; this
 * script only loads the collections, builds snapshots, and applies the plan.
 *
 * Idempotent: re-running after --apply reports zero remaining actions.
 * Use --apply to write; default is a dry-run report.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/reconcile-legacy.mjs
 *   MONGODB_URI="mongodb+srv://..." node scripts/reconcile-legacy.mjs --apply
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

/** Same civil day (UTC calendar date), never a ±24h window. */
function sameBusinessDate(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const sales = await db.collection("sales").find({}).toArray();
  const credits = await db.collection("creditgranteds").find({}).toArray();
  const creditreceiveds = await db.collection("creditreceiveds").find({}).toArray();
  const transfers = await db.collection("transfers").find({}).toArray();
  const movements = await db.collection("movements").find({}).toArray();
  const clients = await db.collection("clients").find({}).toArray();

  const clientNameById = new Map(
    clients.map((c) => [String(c._id), c.name ?? "Cliente general"]),
  );
  const saleById = new Map(sales.map((s) => [String(s._id), s]));
  const creditById = new Map(credits.map((c) => [String(c._id), c]));

  // ─── Snapshots ────────────────────────────────────────────────────────
  const saleSnapshots = sales.map((s) => ({
    id: String(s._id),
    userId: s.userId,
    paymentMode: s.paymentMode,
    total: s.total ?? 0,
    abonosSum: (s.abonos ?? []).reduce((sum, a) => sum + (a.amount ?? 0), 0),
    accountId: String(s.accountId),
    date: s.date,
    clientId: s.clientId ? String(s.clientId) : null,
    deletedAt: s.deletedAt ?? null,
  }));

  const creditSnapshots = credits.map((c) => ({
    id: String(c._id),
    saleId: c.saleId ? String(c.saleId) : null,
    accountId: String(c.accountId),
    date: c.date,
    principal: c.principal ?? 0,
  }));

  const transferSnapshots = transfers.map((t) => ({
    id: String(t._id),
    sourceAccountId: String(t.sourceAccountId),
    destinationAccountId: String(t.destinationAccountId),
    sourceAmount: t.sourceAmount ?? 0,
    destinationAmount: t.destinationAmount ?? 0,
    date: t.date,
    movementIds: t.movementIds
      ? {
          expenseId: t.movementIds.expenseId ? String(t.movementIds.expenseId) : null,
          incomeId: t.movementIds.incomeId ? String(t.movementIds.incomeId) : null,
        }
      : null,
  }));

  // Transfer legs resolved BY VALUE (account/date/amount), not by stored refId.
  // transferId is set to the CURRENT transfer ObjectId.
  const transferLegs = [];
  for (const t of transfers) {
    const expenseLegs = movements.filter(
      (m) =>
        m.link?.kind === "transfer" &&
        m.type === "expense" &&
        String(m.accountId) === String(t.sourceAccountId) &&
        (m.amount ?? 0) === (t.sourceAmount ?? 0) &&
        sameBusinessDate(m.date, t.date),
    );
    const incomeLegs = movements.filter(
      (m) =>
        m.link?.kind === "transfer" &&
        m.type === "income" &&
        String(m.accountId) === String(t.destinationAccountId) &&
        (m.amount ?? 0) === (t.destinationAmount ?? 0) &&
        sameBusinessDate(m.date, t.date),
    );

    const oldTransferId = String(t._id);
    const pickLeg = (candidates) => {
      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1) {
        // Prefer the candidate whose stored refId is the old (non-matching)
        // id; otherwise leave undetermined → the leg is omitted.
        const preferred = candidates.find(
          (m) => m.link && String(m.link.refId) !== oldTransferId,
        );
        return preferred ?? null;
      }
      return null;
    };

    const expenseLeg = t.movementIds?.expenseId ? null : pickLeg(expenseLegs);
    const incomeLeg = t.movementIds?.incomeId ? null : pickLeg(incomeLegs);

    if (expenseLeg) {
      transferLegs.push({
        movementId: String(expenseLeg._id),
        transferId: oldTransferId,
        type: "expense",
      });
    }
    if (incomeLeg) {
      transferLegs.push({
        movementId: String(incomeLeg._id),
        transferId: oldTransferId,
        type: "income",
      });
    }
  }

  // Stale-refId movements: only for kinds salePayment / creditGrantedPrincipal /
  // creditReceivedPrincipal whose stored refId does NOT match a current parent id.
  const allSaleIds = new Set(sales.map((s) => String(s._id)));
  const allCreditGrantedIds = new Set(credits.map((c) => String(c._id)));
  const allCreditReceivedIds = new Set(creditreceiveds.map((c) => String(c._id)));

  const staleRefKinds = ["salePayment", "creditGrantedPrincipal", "creditReceivedPrincipal"];
  const staleRefMovements = movements
    .filter((m) => {
      const kind = m.link?.kind;
      if (!staleRefKinds.includes(kind)) return false;
      const refId = m.link?.refId ? String(m.link.refId) : null;
      if (kind === "salePayment") return refId != null && !allSaleIds.has(refId);
      if (kind === "creditGrantedPrincipal")
        return refId != null && !allCreditGrantedIds.has(refId);
      return refId != null && !allCreditReceivedIds.has(refId);
    })
    .map((m) => ({
      id: String(m._id),
      kind: m.link.kind,
      refId: String(m.link.refId),
      accountId: String(m.accountId),
      date: m.date,
      amount: m.amount ?? 0,
    }));

  // Transfer-kind orphan movements: transfer movements with NO live transfer
  // claiming them. The linked set is every movementId persisted on a live
  // transfer PLUS every value-matched leg in transferLegs.
  const liveTransferLinkedIds = new Set();
  for (const t of transfers) {
    if (t.movementIds?.expenseId) liveTransferLinkedIds.add(String(t.movementIds.expenseId));
    if (t.movementIds?.incomeId) liveTransferLinkedIds.add(String(t.movementIds.incomeId));
  }
  for (const l of transferLegs) liveTransferLinkedIds.add(String(l.movementId));

  const staleTransferMovements = movements
    .filter(
      (m) =>
        m.link?.kind === "transfer" &&
        !liveTransferLinkedIds.has(String(m._id)),
    )
    .map((m) => ({
      id: String(m._id),
      kind: "transfer",
      refId: m.link?.refId != null ? String(m.link.refId) : "",
      accountId: String(m.accountId),
      date: m.date,
      amount: m.amount ?? 0,
    }));

  const staleMovements = [...staleRefMovements, ...staleTransferMovements];

  // Parent resolver for stale movements. Live sales are used for candidate
  // matching (amount <= total); ALL sales docs for refId matching already
  // happened above.
  const liveSales = sales.filter((s) => !s.deletedAt);
  const parentResolver = {
    salePayment(accountId, date, amount) {
      // Prefer an exact full-payment match (amount === sale.total).
      const exact = liveSales.filter(
        (s) =>
          String(s.accountId) === accountId &&
          sameBusinessDate(s.date, date) &&
          (amount ?? 0) === (s.total ?? 0),
      );
      if (exact.length === 1) return { status: "unique", parentId: String(exact[0]._id) };
      if (exact.length > 1) return { status: "ambiguous" };
      // Fallback: partial payment on an on-credit sale (amount < total).
      const partial = liveSales.filter(
        (s) =>
          s.paymentMode === "on-credit" &&
          String(s.accountId) === accountId &&
          sameBusinessDate(s.date, date) &&
          (amount ?? 0) < (s.total ?? 0),
      );
      if (partial.length === 1) return { status: "unique", parentId: String(partial[0]._id) };
      if (partial.length === 0) return { status: "none" };
      return { status: "ambiguous" };
    },
    creditPrincipal(accountId, date, amount) {
      const both = [...credits, ...creditreceiveds];
      const candidates = both.filter(
        (c) =>
          String(c.accountId) === accountId &&
          sameBusinessDate(c.date, date) &&
          (amount ?? 0) === (c.principal ?? 0),
      );
      if (candidates.length === 1) return { status: "unique", parentId: String(candidates[0]._id) };
      if (candidates.length === 0) return { status: "none" };
      return { status: "ambiguous" };
    },
  };

  // ─── Derive the plan via the pure module ──────────────────────────────
  // Node >= 22.6 runs .ts with native type-stripping; legacy-repair.ts uses
  // only erasable TypeScript syntax.
  const { buildLegacyRepairPlan } = await import("../src/lib/legacy-repair.ts");

  const actions = buildLegacyRepairPlan(
    saleSnapshots,
    creditSnapshots,
    transferSnapshots,
    transferLegs,
    staleMovements,
    {
      salePayment: (accountId, date, amount) =>
        parentResolver.salePayment(accountId, date, amount),
      creditPrincipal: (accountId, date, amount) =>
        parentResolver.creditPrincipal(accountId, date, amount),
    },
  );

  // ─── Report ───────────────────────────────────────────────────────────
  console.log(`\nR5-F legacy reconciliation ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Remaining issues: ${actions.length}`);
  for (const [i, a] of actions.entries()) {
    console.log(`  ${i + 1}. [${a.type}] ${a.description}`);
    if (a.type === "create_sale_credit") {
      console.log(
        `       -> principal=${a.principal} account=${a.accountId} date=${new Date(a.date).toISOString()}`,
      );
    }
  }

  if (!APPLY) {
    console.log("\nNo writes performed (dry-run). Re-run with --apply to repair.");
    await mongoose.disconnect();
    process.exit(actions.length > 0 ? 2 : 0);
  }

  // ─── Apply ────────────────────────────────────────────────────────────
  let applied = 0;

  for (const a of actions) {
    if (a.type === "create_sale_credit") {
      const counterparty = a.clientId
        ? clientNameById.get(String(a.clientId)) ?? "Cliente general"
        : "Cliente general";
      const res = await db.collection("creditgranteds").insertOne({
        userId: a.userId,
        counterparty,
        principal: a.principal,
        accountId: new mongoose.Types.ObjectId(String(a.accountId)),
        date: new Date(a.date),
        saleId: a.saleId,
        abonos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      if (res.acknowledged && res.insertedId) applied += 1;
    }

    else if (a.type === "link_sale_credit") {
      await db.collection("creditgranteds").updateOne(
        { _id: new mongoose.Types.ObjectId(a.creditId) },
        { $set: { saleId: a.saleId } },
      );
      applied += 1;
    }

    else if (a.type === "delete_orphan_credit") {
      const creditId = new mongoose.Types.ObjectId(a.creditId);
      await db.collection("movements").deleteMany({ "link.refId": a.creditId });
      // Legacy salePayment movements still referencing the gone sale.
      await db.collection("movements").deleteMany({ "link.refId": a.saleId });
      const del = await db.collection("creditgranteds").deleteOne({ _id: creditId });
      if (del.deletedCount === 1) applied += 1;
    }

    else if (a.type === "link_transfer_movements") {
      const merged = { ...(a.expenseId ? { expenseId: a.expenseId } : {}), ...(a.incomeId ? { incomeId: a.incomeId } : {}) };
      await db.collection("transfers").updateOne(
        { _id: new mongoose.Types.ObjectId(a.transferId) },
        { $set: { movementIds: merged } },
      );
      // Relink the stored refId of each newly linked leg so findOrphanMovements
      // no longer flags them.
      for (const legId of [a.expenseId, a.incomeId]) {
        if (!legId) continue;
        await db.collection("movements").updateOne(
          { _id: new mongoose.Types.ObjectId(legId) },
          { $set: { "link.refId": a.transferId } },
        );
      }
      applied += 1;
    }

    else if (a.type === "relink_movement_ref_id") {
      await db.collection("movements").updateOne(
        { _id: new mongoose.Types.ObjectId(a.movementId) },
        { $set: { "link.refId": a.newParentId } },
      );
      applied += 1;
    }

    else if (a.type === "delete_orphan_movement") {
      const del = await db.collection("movements").deleteOne({
        _id: new mongoose.Types.ObjectId(a.movementId),
      });
      if (del.deletedCount === 1) applied += 1;
    }

    else if (a.type === "purge_soft_deleted_sale") {
      const saleDoc = saleById.get(a.saleId);
      if (!saleDoc) continue;
      // Restore stock for product items (POS-8).
      for (const item of saleDoc.items ?? []) {
        await db.collection("catalogitems").updateOne(
          { _id: new mongoose.Types.ObjectId(String(item.itemId)), type: "product" },
          { $inc: { stock: item.quantity } },
        );
      }
      // Movements referencing the sale (salePayment legacy refId = saleId).
      await db.collection("movements").deleteMany({ "link.refId": a.saleId });
      // Linked sale-born credit and its movements.
      const linked = creditSnapshots.find((c) => c.saleId === a.saleId);
      if (linked) {
        await db.collection("movements").deleteMany({ "link.refId": linked.id });
        await db.collection("creditgranteds").deleteOne({
          _id: new mongoose.Types.ObjectId(linked.id),
        });
      }
      const del = await db.collection("sales").deleteOne({
        _id: new mongoose.Types.ObjectId(a.saleId),
      });
      if (del.deletedCount === 1) applied += 1;
    }
  }

  console.log(`\nApplied ${applied} repair action(s).`);

  // ─── Idempotency re-check after apply ─────────────────────────────────
  const remaining = await deriveRemainingPlan(db);

  if (remaining.length > 0) {
    console.log(
      `Idempotency check: ${remaining.length} issue(s) REMAIN after apply:`,
    );
    for (const r of remaining) console.log(`  - [${r.type}] ${r.description}`);
    process.exitCode = 3;
  } else {
    console.log("Idempotency check: zero remaining issues.");
  }

  async function deriveRemainingPlan(dbase) {
    const s2 = await dbase.collection("sales").find({}).toArray();
    const c2 = await dbase.collection("creditgranteds").find({}).toArray();
    const cr2 = await dbase.collection("creditreceiveds").find({}).toArray();
    const t2 = await dbase.collection("transfers").find({}).toArray();
    const m2 = await dbase.collection("movements").find({}).toArray();

    const saleSnap2 = s2.map((s) => ({
      id: String(s._id),
      userId: s.userId,
      paymentMode: s.paymentMode,
      total: s.total ?? 0,
      abonosSum: (s.abonos ?? []).reduce((sum, a) => sum + (a.amount ?? 0), 0),
      accountId: String(s.accountId),
      date: s.date,
      clientId: s.clientId ? String(s.clientId) : null,
      deletedAt: s.deletedAt ?? null,
    }));
    const creditSnap2 = c2.map((c) => ({
      id: String(c._id),
      saleId: c.saleId ? String(c.saleId) : null,
      accountId: String(c.accountId),
      date: c.date,
      principal: c.principal ?? 0,
    }));
    const transferSnap2 = t2.map((t) => ({
      id: String(t._id),
      sourceAccountId: String(t.sourceAccountId),
      destinationAccountId: String(t.destinationAccountId),
      sourceAmount: t.sourceAmount ?? 0,
      destinationAmount: t.destinationAmount ?? 0,
      date: t.date,
      movementIds: t.movementIds
        ? {
            expenseId: t.movementIds.expenseId ? String(t.movementIds.expenseId) : null,
            incomeId: t.movementIds.incomeId ? String(t.movementIds.incomeId) : null,
          }
        : null,
    }));

    // Resolve transfer legs by value again.
    const legs2 = [];
    for (const t of t2) {
      const ex = m2.find(
        (m) =>
          m.link?.kind === "transfer" &&
          m.type === "expense" &&
          String(m.accountId) === String(t.sourceAccountId) &&
          (m.amount ?? 0) === (t.sourceAmount ?? 0) &&
          sameBusinessDate(m.date, t.date),
      );
      const inc = m2.find(
        (m) =>
          m.link?.kind === "transfer" &&
          m.type === "income" &&
          String(m.accountId) === String(t.destinationAccountId) &&
          (m.amount ?? 0) === (t.destinationAmount ?? 0) &&
          sameBusinessDate(m.date, t.date),
      );
      if (ex && !t.movementIds?.expenseId)
        legs2.push({ movementId: String(ex._id), transferId: String(t._id), type: "expense" });
      if (inc && !t.movementIds?.incomeId)
        legs2.push({ movementId: String(inc._id), transferId: String(t._id), type: "income" });
    }

    const allSaleIds2 = new Set(s2.map((s) => String(s._id)));
    const allCG2 = new Set(c2.map((c) => String(c._id)));
    const allCR2 = new Set(cr2.map((c) => String(c._id)));
    const staleRefMovements2 = m2
      .filter((m) => {
        const k = m.link?.kind;
        if (!staleRefKinds.includes(k)) return false;
        const r = m.link?.refId ? String(m.link.refId) : null;
        if (k === "salePayment") return r != null && !allSaleIds2.has(r);
        if (k === "creditGrantedPrincipal") return r != null && !allCG2.has(r);
        return r != null && !allCR2.has(r);
      })
      .map((m) => ({
        id: String(m._id),
        kind: m.link.kind,
        refId: String(m.link.refId),
        accountId: String(m.accountId),
        date: m.date,
        amount: m.amount ?? 0,
      }));

    // Transfer-kind orphan movements: transfer movements with no live transfer
    // claiming them (every persisted movementId plus every value-matched leg).
    const linkedIds2 = new Set();
    for (const t of t2) {
      if (t.movementIds?.expenseId) linkedIds2.add(String(t.movementIds.expenseId));
      if (t.movementIds?.incomeId) linkedIds2.add(String(t.movementIds.incomeId));
    }
    for (const l of legs2) linkedIds2.add(String(l.movementId));

    const staleTransfer2 = m2
      .filter(
        (m) =>
          m.link?.kind === "transfer" &&
          !linkedIds2.has(String(m._id)),
      )
      .map((m) => ({
        id: String(m._id),
        kind: "transfer",
        refId: m.link?.refId != null ? String(m.link.refId) : "",
        accountId: String(m.accountId),
        date: m.date,
        amount: m.amount ?? 0,
      }));

    const stale2 = [...staleRefMovements2, ...staleTransfer2];

    const live2 = s2.filter((s) => !s.deletedAt);
    return buildLegacyRepairPlan(saleSnap2, creditSnap2, transferSnap2, legs2, stale2, {
      salePayment: (accountId, date, amount) => {
        const cand = live2.filter(
          (s) =>
            String(s.accountId) === accountId &&
            sameBusinessDate(s.date, date) &&
            (amount ?? 0) <= (s.total ?? 0),
        );
        if (cand.length === 1) return { status: "unique", parentId: String(cand[0]._id) };
        return cand.length === 0 ? { status: "none" } : { status: "ambiguous" };
      },
      creditPrincipal: (accountId, date, amount) => {
        const cand = [...c2, ...cr2].filter(
          (c) =>
            String(c.accountId) === accountId &&
            sameBusinessDate(c.date, date) &&
            (amount ?? 0) === (c.principal ?? 0),
        );
        if (cand.length === 1) return { status: "unique", parentId: String(cand[0]._id) };
        return cand.length === 0 ? { status: "none" } : { status: "ambiguous" };
      },
    });
  }
} catch (err) {
  console.error("reconcile-legacy failed:", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
