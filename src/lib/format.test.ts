import { describe, expect, it } from "vitest";
import { formatAmount, formatDate } from "./format";

describe("formatAmount", () => {
  it("formats COP with 0 decimals", () => {
    const result = formatAmount(50000, "COP", "es");
    expect(result).toContain("50.000");
    expect(result).toContain("COP");
  });

  it("formats USD with 2 decimals", () => {
    const result = formatAmount(1599, "USD", "en");
    expect(result).toContain("15.99");
    expect(result).toContain("$");
  });

  it("formats MXN with 2 decimals", () => {
    const result = formatAmount(10000, "MXN", "es");
    expect(result).toContain("100");
    expect(result).toContain("MXN");
  });

  it("formats EUR with 2 decimals", () => {
    const result = formatAmount(2500, "EUR", "en");
    expect(result).toContain("25");
    expect(result).toContain("€");
  });

  it("formats zero amount", () => {
    const result = formatAmount(0, "COP", "es");
    expect(result).toContain("0");
  });

  it("formats large amounts", () => {
    const result = formatAmount(100000000, "COP", "es");
    expect(result).toContain("100");
  });

  it("emits the currency code exactly once (guard against double formatting)", () => {
    // JSX must not append {currency} after formatAmount output — these
    // assertions lock that contract.
    expect(formatAmount(50000, "COP", "es").match(/COP/g)).toHaveLength(1);
    expect(formatAmount(10000, "MXN", "es").match(/MXN/g)).toHaveLength(1);
  });

  it("emits the currency symbol exactly once for symbol-styled locales", () => {
    expect(formatAmount(1599, "USD", "en").match(/\$/g)).toHaveLength(1);
    expect(formatAmount(2500, "EUR", "en").match(/€/g)).toHaveLength(1);
  });
});

describe("formatDate", () => {
  // Business dates are civil dates encoded as midnight UTC; formatDate pins
  // timeZone: 'UTC', so these EXACT strings hold on any host timezone
  // (the suite forces TZ=America/Bogota via vitest.setup.ts).
  it("formats an ISO date string as the stored civil date", () => {
    expect(formatDate("2026-03-15", "en")).toBe("Mar 15, 2026");
  });

  it("does NOT shift a midnight-UTC date on west-of-UTC hosts", () => {
    // Without the UTC pin, a Bogota host would render this as "Mar 14".
    const result = formatDate(new Date("2026-03-15T00:00:00Z"), "en");
    expect(result).toBe("Mar 15, 2026");
  });

  it("renders a Date through its UTC calendar parts", () => {
    // Built via Date.UTC so its UTC parts are identical on every host.
    const date = new Date(Date.UTC(2026, 6, 4));
    expect(formatDate(date, "en")).toBe("Jul 4, 2026");
  });

  it("formats in Spanish locale", () => {
    expect(formatDate("2026-01-20", "es")).toBe("20 ene 2026");
  });
});

// Founder rule (PROJECT-RULES §15-UX.1, ronda final pre-beta 2026-09-30):
// in locale "es" the thousands separator shows from 1.000 (Latin America
// reads 9.999 with the dot). CLDR `es` defaults to grouping from 10.000
// (minimumGroupingDigits: 2 — verified with Node's ICU); formatAmount
// post-processes its own formatToParts output, so symbols/code/decimals/
// sign stay exactly what Intl emits.
// NOTE: the separator before the currency code is NBSP (U+00A0) exactly as
// Intl emits it — matching literals must write "\u00a0", not a plain space.
describe("formatAmount — es thousands separator from 1.000 (founder 2026-09-30)", () => {
  it("groups 4-digit COP integers (9999 → 9.999)", () => {
    expect(formatAmount(9999, "COP", "es")).toBe("9.999\u00a0COP");
    expect(formatAmount(1000, "COP", "es")).toBe("1.000\u00a0COP");
  });

  it("leaves 3-digit values ungrouped and 5+ digits to native grouping", () => {
    expect(formatAmount(999, "COP", "es")).toBe("999\u00a0COP");
    expect(formatAmount(10000, "COP", "es")).toBe("10.000\u00a0COP");
    expect(formatAmount(50000, "COP", "es")).toBe("50.000\u00a0COP");
  });

  it("groups exponent-2 currencies keeping decimal honesty (9999.00 USD es)", () => {
    expect(formatAmount(999900, "USD", "es")).toContain("9.999,00");
  });

  it("preserves the minus sign and the code-exactly-once contract", () => {
    expect(formatAmount(-9999, "COP", "es")).toContain("-9.999");
    expect(formatAmount(9999, "COP", "es").match(/COP/g)).toHaveLength(1);
  });

  it("does not alter locale en (groups natively from 1,000)", () => {
    expect(formatAmount(9999, "COP", "en")).toContain("9,999");
  });
});
