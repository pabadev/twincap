export interface MovementDraftProposalV1 {
  schemaVersion: 1;
  intent: "create_movement" | "unsupported";
  type: "expense" | "income" | null;
  amountText: string | null;
  note: string | null;
  date: string | null;
  categoryHint: string | null;
  missingFields: Array<"type" | "amount" | "account" | "category" | "context" | "date">;
  clarification: string | null;
}

const PROPOSAL_KEYS = [
  "schemaVersion",
  "intent",
  "type",
  "amountText",
  "note",
  "date",
  "categoryHint",
  "missingFields",
  "clarification",
].sort();
const MISSING_FIELDS = new Set(["type", "amount", "account", "category", "context", "date"]);

export function parseMovementDraftProposalV1(raw: string): MovementDraftProposalV1 | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const value: unknown = JSON.parse(raw.slice(start, end + 1));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const candidate = value as Record<string, unknown>;
    if (Object.keys(candidate).sort().join("|") !== PROPOSAL_KEYS.join("|")) return null;
    if (candidate.schemaVersion !== 1) return null;
    if (candidate.intent !== "create_movement" && candidate.intent !== "unsupported") return null;
    if (candidate.type !== null && candidate.type !== "expense" && candidate.type !== "income") {
      return null;
    }
    if (candidate.intent === "create_movement" && candidate.type !== "expense") return null;
    if (candidate.intent === "unsupported" && candidate.type !== null) return null;
    if (candidate.amountText !== null && !isCanonicalAmount(candidate.amountText)) return null;
    if (!isNullableString(candidate.note) || !isNullableString(candidate.date)) return null;
    if (candidate.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(candidate.date)) return null;
    if (!isNullableString(candidate.categoryHint) || !isNullableString(candidate.clarification)) {
      return null;
    }
    if (
      !Array.isArray(candidate.missingFields) ||
      !candidate.missingFields.every(
        (field) => typeof field === "string" && MISSING_FIELDS.has(field),
      )
    ) {
      return null;
    }

    return candidate as unknown as MovementDraftProposalV1;
  } catch {
    return null;
  }
}

function isCanonicalAmount(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value) &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0 &&
    Number(value) <= Number.MAX_SAFE_INTEGER
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
