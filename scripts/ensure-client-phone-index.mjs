/**
 * Read-only client phone audit by default; --apply creates the workspace-scoped
 * unique index only when every stored non-empty phone is already canonical E.164.
 * The report omits client names and full phone numbers.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ensure-client-phone-index.mjs
 *   node --env-file=.env.local scripts/ensure-client-phone-index.mjs --apply
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const COLLECTION = "clients";
const INDEX_NAME = "workspaceId_1_phone_1_unique";

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
    const invalid = [];
    const missing = [];
    const groups = new Map();

    for (const doc of docs) {
      const id = doc._id.toString();
      const workspaceId = doc.workspaceId?.toString() ?? "missing-workspace";
      if (doc.phone !== undefined && doc.phone !== null && typeof doc.phone !== "string") {
        invalid.push({
          workspaceId,
          clientId: id,
          valueType: typeof doc.phone,
        });
        continue;
      }
      const phone = typeof doc.phone === "string" ? doc.phone.trim() : "";
      if (!phone) {
        missing.push({ workspaceId, clientId: id });
        continue;
      }

      const canonical = normalizePhoneE164(phone);
      if (!canonical || canonical !== phone) {
        invalid.push({ workspaceId, clientId: id, phone: maskPhone(phone) });
        continue;
      }
      const key = `${workspaceId}:${canonical}`;
      const matches = groups.get(key) ?? [];
      matches.push({ workspaceId, clientId: id, phone: maskPhone(canonical) });
      groups.set(key, matches);
    }

    const duplicates = [...groups.values()].filter((matches) => matches.length > 1);
    const indexes = await db.collection(COLLECTION).indexes();
    const conflictingIndex = indexes.find(
      (index) =>
        JSON.stringify(index.key) === JSON.stringify({ workspaceId: 1, phone: 1 }) &&
        (index.unique !== true ||
          JSON.stringify(index.partialFilterExpression ?? {}) !==
            JSON.stringify({ phone: { $gt: "" } })),
    );

    const report = {
      mode: APPLY ? "apply" : "audit-only",
      collection: COLLECTION,
      totalClients: docs.length,
      clientsWithoutPhone: missing.length,
      clientsWithInvalidOrNonCanonicalPhone: invalid.length,
      duplicateWorkspacePhoneGroups: duplicates.length,
      invalid,
      duplicateGroups: duplicates,
      note: "Missing phones are excluded by the partial index and should be completed in the app.",
    };
    console.log(JSON.stringify(report, null, 2));

    if (conflictingIndex) {
      console.error(`Conflicting index '${conflictingIndex.name}' exists; no changes made.`);
      process.exitCode = 1;
    } else if (invalid.length > 0 || duplicates.length > 0) {
      console.error(
        "Resolve invalid/non-canonical numbers and duplicate groups before index creation.",
      );
      process.exitCode = 2;
    } else if (APPLY) {
      await db.collection(COLLECTION).createIndex(
        { workspaceId: 1, phone: 1 },
        {
          name: INDEX_NAME,
          unique: true,
          partialFilterExpression: { phone: { $gt: "" } },
        },
      );
      console.log(`Created ${INDEX_NAME}.`);
    } else {
      console.log(`Audit passed. Use --apply to create ${INDEX_NAME}.`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Client phone audit failed.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
