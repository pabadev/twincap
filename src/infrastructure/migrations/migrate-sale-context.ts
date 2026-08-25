import { MovementModel } from "../models/movement";
import { CreditGrantedModel } from "../models/credit-granted";

export interface MigrationResult {
  salePayments: { matched: number; modified: number };
  saleAbonos: { matched: number; modified: number };
}

/**
 * D3-bis migration: reclassify sale-linked movements to Business.
 *
 * - salePayment movements → Business (POS = business activity)
 * - creditGrantedAbono movements whose parent CreditGranted has a saleId → Business
 *
 * Idempotent: only updates where context !== 'Business'.
 */
export async function migrateSaleContext(): Promise<MigrationResult> {
  // 1. salePayment → Business
  const salePayments = await MovementModel.updateMany(
    { "link.kind": "salePayment", context: { $ne: "Business" } },
    { $set: { context: "Business" } },
  );

  // 2. creditGrantedAbono on sale-linked credits → Business
  // Find all creditGrantedAbono movements still marked Personal
  const abonosToCheck = await MovementModel.find({
    "link.kind": "creditGrantedAbono",
    context: { $ne: "Business" },
  }).lean();

  let saleAbonoModified = 0;
  // Process in batches to avoid N+1
  const creditIds = [...new Set(abonosToCheck.map((m) => m.link?.refId).filter(Boolean))];
  if (creditIds.length > 0) {
    const creditsWithSale = await CreditGrantedModel.find({
      _id: { $in: creditIds },
      saleId: { $exists: true, $ne: null },
    })
      .select("_id")
      .lean();

    const saleCreditIds = new Set(creditsWithSale.map((c) => String(c._id)));

    const idsToUpdate = abonosToCheck
      .filter((m) => m.link?.refId && saleCreditIds.has(m.link.refId))
      .map((m) => m._id);

    if (idsToUpdate.length > 0) {
      const result = await MovementModel.updateMany(
        { _id: { $in: idsToUpdate } },
        { $set: { context: "Business" } },
      );
      saleAbonoModified = result.modifiedCount;
    }
  }

  return {
    salePayments: {
      matched: salePayments.matchedCount,
      modified: salePayments.modifiedCount,
    },
    saleAbonos: {
      matched: abonosToCheck.length,
      modified: saleAbonoModified,
    },
  };
}
