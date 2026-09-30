/**
 * One-off data cleanup for the client phone unique index (Fase 9 checklist item 8).
 *
 * The ensure-client-phone-index audit is fail-closed: it refuses to create the
 * workspace-scoped unique index while any stored phone is not ALREADY canonical
 * E.164 (normalizePhoneE164(phone) !== phone → invalid). This script resolves the
 * backlog in two tiers, without guessing:
 *
 *   Tier 1 — phone parses to canonical E.164 but is stored non-canonically
 *            (missing +, separators, etc.) → set phone = canonical (data-preserving).
 *   Tier 2 — phone cannot be parsed at all (test junk like "123") → set phone = ""
 *            (the partial index excludes empty phones; the app shows phoneMissing).
 *
 * Fail-closed by design:
 *   - Dry-run by default; --apply required to write.
 *   - If two clients in the same workspace would end up with the SAME canonical
 *     phone after normalization, nothing is written (exit 2) — the unique index
 *     would reject it and silently dropping one side is a product decision.
 *   - Full phone numbers are never printed (same masking as the audit script).
 *
 * Usage:
 *   node --env-file=.env.local scripts/clear-invalid-client-phones.mjs
 *   node --env-file=.env.local scripts/clear-invalid-client-phones.mjs --apply
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const COLLECTION = "clients";

/** Same predicate as ensure-client-phone-index.mjs — keep in sync. */
function normalizePhoneE164(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("+") || !/^[+\d\s().-]+$/.test(trimmed)) return null;
  const normalized = `+${trimmed.slice(1).replace(/[\s().-]/g, "")}`;
  return /^\+[1-9]\d{1,14}$/.test(normalized) ? normalized : null;
}

function maskPhone(phone) {
  return phone ? `••••${phone.slice(-4)}` : "sin teléfono";
}

try {
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  const collections = await db.listCollections({ name: COLLECTION }).toArray();
  if (collections.length === 0) {
    console.error(`Required collection '${COLLECTION}' does not exist; no changes made.`);
    process.exitCode = 1;
  } else {
    const docs = await db
      .collection(COLLECTION)
      .find({}, { projection: { _id: 1, workspaceId: 1, phone: 1 } })
      .toArray();

    const normalizeOps = [];
    const clearOps = [];
    const invalidNonString = [];
    const postNormalization = new Map();

    for (const doc of docs) {
      const id = doc._id.toString();
      const workspaceId = doc.workspaceId?.toString() ?? "missing-workspace";

      if (doc.phone !== undefined && doc.phone !== null && typeof doc.phone !== "string") {
        invalidNonString.push({ workspaceId, clientId: id, valueType: typeof doc.phone });
        continue;
      }
      const phone = typeof doc.phone === "string" ? doc.phone.trim() : "";
      if (!phone) continue; // already excluded by the partial index
      const canonical = normalizePhoneE164(phone);
      if (!canonical) {
        clearOps.push({ workspaceId, clientId: id, phone: maskPhone(phone) });
        continue;
      }
      if (canonical !== phone) {
        normalizeOps.push({
          workspaceId,
          clientId: id,
          from: maskPhone(phone),
          to: maskPhone(canonical),
        });
      }
      const key = `${workspaceId}:${canonical}`;
      postNormalization.set(key, (postNormalization.get(key) ?? 0) + 1);
    }

    const collisions = [...postNormalization.entries()]
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ group: key, count }));

    const report = {
      mode: APPLY ? "apply" : "dry-run",
      collection: COLLECTION,
      totalClients: docs.length,
      normalizedToCanonical: normalizeOps.length,
      clearedAsUnparseable: clearOps.length,
      nonStringPhones: invalidNonString.length,
      postNormalizationCollisions: collisions.length,
      normalize: normalizeOps,
      clear: clearOps,
      invalidNonString,
      collisions,
      note: "Tier 1 preserves the number in canonical E.164; Tier 2 blanks unparseable junk. Empty phones are excluded by the partial index.",
    };
    console.log(JSON.stringify(report, null, 2));

    if (invalidNonString.length > 0) {
      console.error("Non-string phone values require manual inspection; no changes made.");
      process.exitCode = 2;
    } else if (collisions.length > 0) {
      console.error(
        "Normalization would create duplicate workspace+phone pairs; resolve manually before applying.",
      );
      process.exitCode = 2;
    } else if (APPLY) {
      const bulk = [];
      // Re-derive the canonical literal at write time from the stored doc to
      // avoid trusting masked report values.
      for (const op of normalizeOps) {
        const doc = docs.find((d) => d._id.toString() === op.clientId);
        if (!doc) throw new Error(`Normalization target ${op.clientId} vanished mid-run`);
        const canonical = normalizePhoneE164(String(doc.phone).trim());
        if (!canonical)
          throw new Error(`Refusing to normalize unparseable phone for ${op.clientId}`);
        bulk.push({
          updateOne: { filter: { _id: doc._id }, update: { $set: { phone: canonical } } },
        });
      }
      for (const op of clearOps) {
        bulk.push({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(op.clientId) },
            update: { $set: { phone: "" } },
          },
        });
      }
      if (bulk.length > 0) {
        const result = await db.collection(COLLECTION).bulkWrite(bulk, { ordered: true });
        console.log(
          `[APPLY COMPLETE] modified=${result.modifiedCount} matched=${result.matchedCount}`,
        );
      } else {
        console.log("[APPLY COMPLETE] nothing to change.");
      }
    } else if (normalizeOps.length > 0 || clearOps.length > 0) {
      console.log("Dry-run complete. Use --apply to write the changes above.");
    } else {
      console.log("Nothing to change: every stored phone is already canonical E.164.");
    }
  }
} catch (error) {
  console.error("Unexpected failure:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
