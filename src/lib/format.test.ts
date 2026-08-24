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
