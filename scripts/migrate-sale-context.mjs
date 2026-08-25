/**
 * D3-bis one-off migration: reclassify sale-linked movements to Business.
 *
 * Idempotent and non-destructive: only updates where context !== 'Business'.
 * Safe to re-run any number of times.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/migrate-sale-context.mjs
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // 1. salePayment → Business
  const sp = await db
    .collection("movements")
    .updateMany(
      { "link.kind": "salePayment", context: { $ne: "Business" } },
      { $set: { context: "Business" } },
    );
  console.log(`salePayments: matched=${sp.matchedCount} modified=${sp.modifiedCount}`);

  // 2. creditGrantedAbono on sale-linked credits → Business
  const abonos = await db
    .collection("movements")
    .find({ "link.kind": "creditGrantedAbono", context: { $ne: "Business" } })
    .toArray();

  let abonoModified = 0;
  const creditIds = [...new Set(abonos.map((m) => m.link?.refId).filter(Boolean))];

  if (creditIds.length > 0) {
    const saleCredits = await db
      .collection("creditgranteds")
      .find({ _id: { $in: creditIds.map(new mongoose.Types.ObjectId()) }, saleId: { $exists: true, $ne: null } })
      .toArray();

    const saleCreditSet = new Set(saleCredits.map((c) => String(c._id)));
    const idsToFix = abonos
      .filter((m) => m.link?.refId && saleCreditSet.has(m.link.refId))
      .map((m) => m._id);

    if (idsToFix.length > 0) {
      const r = await db
        .collection("movements")
        .updateMany({ _id: { $in: idsToFix } }, { $set: { context: "Business" } });
      abonoModified = r.modifiedCount;
    }
  }

  console.log(`saleAbonos: checked=${abonos.length} modified=${abonoModified}`);
} catch (err) {
  console.error("migrate-sale-context failed:", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
