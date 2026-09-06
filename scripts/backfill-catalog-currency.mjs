/**
 * R14-A one-off backfill: persist `currency` on legacy CatalogItem documents
 * that predate the currency-integrity phase and therefore lack the field.
 *
 * Semantics replicate the OLD repository exactly: every catalog item of a
 * workspace was read with the currency of the FIRST account of that workspace
 * (findOne on accounts, natural _id order). Assigning that same currency keeps
 * the observed prices unchanged. Workspaces with no accounts fall back to COP
 * (DEFAULT_CURRENCY); the old code threw NotFoundError in that case.
 *
 * Idempotent and non-destructive: only touches documents where currency is
 * missing, null, or empty. Safe to re-run any number of times.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/backfill-catalog-currency.mjs
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const DEFAULT_CURRENCY = "COP";

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const items = await db
    .collection("catalogitems")
    .find({
      $or: [
        { currency: { $exists: false } },
        { currency: null },
        { currency: "" },
      ],
    })
    .project({ workspaceId: 1 })
    .toArray();

  if (items.length === 0) {
    console.log("No legacy catalog items without currency found.");
    process.exit(0);
  }

  const workspaceIds = [...new Set(items.map((i) => String(i.workspaceId)))];
  console.log(
    `Legacy items without currency: ${items.length} across ${workspaceIds.length} workspace(s).`,
  );

  let updated = 0;
  for (const workspaceId of workspaceIds) {
    // Same resolution as the old repository: first account of the workspace.
    const account = await db
      .collection("accounts")
      .findOne({ workspaceId: new mongoose.Types.ObjectId(workspaceId) });

    const currency = account?.currency ?? DEFAULT_CURRENCY;

    const result = await db.collection("catalogitems").updateMany(
      {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        $or: [
          { currency: { $exists: false } },
          { currency: null },
          { currency: "" },
        ],
      },
      { $set: { currency } },
    );
    updated += result.modifiedCount;
    console.log(
      `  workspace ${workspaceId}: currency=${currency} matched=${result.matchedCount} modified=${result.modifiedCount} (account=${account ? String(account._id) : "none"})`,
    );
  }

  console.log(`Backfill complete: ${updated} document(s) updated.`);
} catch (err) {
  console.error("backfill-catalog-currency failed:", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}