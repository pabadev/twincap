/**
 * R6-P5: correct movement parent references in Atlas.
 *
 * Classifies every movement whose `link.refId` does not resolve (by id) to a
 * live parent:
 *   - RELINK  — a live parent matches by value (accountId + date + amount),
 *               so the movement is legitimate but its refId is a stale legacy
 *               UUID. We correct refId to the live parent's _id.
 *   - ORPHAN  — no live parent by id OR value. The parent was deleted without
 *               cascading. Candidate for deletion.
 *
 * Idempotent: re-running after --apply reports nothing to do. Use --apply to
 * write; default is a dry-run report.
 *
 * Usage:
 *   MONGODB_URI="..." node scripts/clean-orphan-movements.mjs
 *   MONGODB_URI="..." node scripts/clean-orphan-movements.mjs --apply
 *
 * When MONGODB_URI is not exported it is loaded from .env.local.
 */
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

let uri = process.env.MONGODB_URI;
if (!uri) {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, "utf8");
    const m = env.match(/^MONGODB_URI\s*=\s*(.+)$/m);
    if (m) uri = m[1].trim().replace(/^["']|["']$/g, "");
  }
}
if (!uri) {
  console.error("MONGODB_URI environment variable (or .env.local) is required");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

// Business-date UTC key (YYYY-MM-DD) for value reconciliation.
function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const sales = await db.collection("sales").find({}).toArray();
  const creditsGranted = await db.collection("creditgranteds").find({}).toArray();
  const creditsReceived = await db.collection("creditreceiveds").find({}).toArray();
  const payables = await db.collection("payables").find({}).toArray();
  const transfers = await db.collection("transfers").find({}).toArray();
  const accounts = await db.collection("accounts").find({}).toArray();
  const movements = await db.collection("movements").find({}).toArray();

  // Build live parent lookups. For linkable kinds we also record the identity
  // (accountId + dateKey + amount) -> live parent id, for legacy reconciliation.
  const liveId = (docs) => new Set(docs.map((d) => String(d._id)));
  const identityIndex = (docs, amountField) => {
    const idx = new Map(); // `${accountId}|${dateKey}|${amount}` -> id
    for (const d of docs) {
      const key = `${String(d.accountId)}|${dateKey(d.date)}|${d[amountField] ?? 0}`;
      if (!idx.has(key)) idx.set(key, String(d._id)); // first wins
    }
    return idx;
  };

  const linkable = {
    creditReceivedPrincipal: {
      ids: liveId(creditsReceived),
      byValue: identityIndex(creditsReceived, "principal"),
    },
    creditGrantedPrincipal: {
      ids: liveId(creditsGranted),
      byValue: identityIndex(creditsGranted, "principal"),
    },
    salePayment: {
      ids: liveId(sales),
      byValue: identityIndex(sales, "total"),
    },
  };

  const singleIdKinds = {
    opening: liveId(accounts),
    transfer: liveId(transfers),
    creditReceivedAbono: liveId(creditsReceived),
    creditGrantedAbono: liveId(creditsGranted),
    payableInitialPayment: liveId(payables),
    payableAbono: liveId(payables),
  };

  const toRelink = [];
  const toDelete = [];

  for (const mv of movements) {
    if (!mv.link) continue;
    const kind = mv.link.kind;
    const refId = mv.link.refId != null ? String(mv.link.refId) : "";

    if (linkable[kind]) {
      const { ids, byValue } = linkable[kind];
      if (ids.has(refId)) continue; // live by id
      const key = `${String(mv.accountId)}|${dateKey(mv.date)}|${mv.amount ?? 0}`;
      const liveIdFor = byValue.get(key);
      if (liveIdFor) {
        toRelink.push({ mv, newRefId: liveIdFor });
      } else {
        toDelete.push(mv);
      }
    } else if (singleIdKinds[kind]) {
      if (!singleIdKinds[kind].has(refId)) toDelete.push(mv);
    }
    // kinds with empty/missing refId or unknown kinds: skip
  }

  console.log(`\nR6-P5 movement reference repair ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Movements to RELINK: ${toRelink.length}`);
  for (const { mv, newRefId } of toRelink) {
    console.log(
      `  mv=${String(mv._id)} kind=${mv.link.kind} refId=${String(mv.link.refId)} -> ${newRefId} amount=${mv.amount} date=${new Date(mv.date).toISOString().slice(0,10)}`,
    );
  }
  console.log(`Movements to DELETE (orphans): ${toDelete.length}`);
  for (const mv of toDelete) {
    console.log(
      `  mv=${String(mv._id)} kind=${mv.link.kind} refId=${String(mv.link.refId)} type=${mv.type} amount=${mv.amount} user=${String(mv.userId)} date=${new Date(mv.date).toISOString().slice(0,10)}`,
    );
  }

  if (APPLY) {
    for (const { mv, newRefId } of toRelink) {
      await db.collection("movements").updateOne(
        { _id: mv._id },
        { $set: { "link.refId": newRefId } },
      );
      console.log(`  relinked ${String(mv._id)} -> ${newRefId}`);
    }
    if (toDelete.length > 0) {
      const ids = toDelete.map((o) => o._id);
      const res = await db.collection("movements").deleteMany({ _id: { $in: ids } });
      console.log(`  deleted ${res.deletedCount} orphan(s)`);
    } else {
      console.log("  no orphans to delete.");
    }
    console.log("\nApply complete.");
  } else {
    console.log("\nNo writes performed (dry-run). Re-run with --apply to apply.");
  }

  await mongoose.disconnect();
} catch (err) {
  console.error("clean-orphan-movements failed:", err);
  process.exitCode = 1;
}
