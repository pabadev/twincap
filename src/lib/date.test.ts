import { describe, expect, it } from "vitest";
import { businessDateToInputValue, toDateInputValue } from "./date";

describe("toDateInputValue", () => {
  it("returns the LOCAL calendar date of the given instant", () => {
    // Built from local getters, so the roundtrip holds on any host TZ.
    const local = new Date(2026, 7, 24); // Aug 24 local
    expect(toDateInputValue(local)).toBe("2026-08-24");
  });

  it("pads month and day to two digits", () => {
    const local = new Date(2026, 0, 5); // Jan 5 local
    expect(toDateInputValue(local)).toBe("2026-01-05");
  });

  it("defaults to the current instant without throwing", () => {
    const value = toDateInputValue();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("never uses the UTC calendar date for late-evening instants", () => {
    // 2026-08-24T22:00:00-05:00 is already Aug 25 in UTC. The local calendar
    // date must still be Aug 24 (this test runs with TZ=America/Bogota).
    const instant = new Date("2026-08-24T22:00:00-05:00");
    expect(toDateInputValue(instant)).toBe("2026-08-24");
  });
});

describe("businessDateToInputValue", () => {
  it("decodes a stored civil date identically on any host timezone", () => {
    // Midnight UTC in Bogota is 19:00 of the PREVIOUS local day; the decoded
    // civil value must remain the stored day.
    const stored = new Date("2026-03-15");
    expect(businessDateToInputValue(stored)).toBe("2026-03-15");
  });

  it("pads month and day to two digits", () => {
    const stored = new Date("2026-01-05");
    expect(businessDateToInputValue(stored)).toBe("2026-01-05");
  });

  it("ignores the local-time shift west of UTC", () => {
    const stored = new Date("2026-01-01T00:00:00Z"); // Dec 31 locally in Bogota
    expect(businessDateToInputValue(stored)).toBe("2026-01-01");
  });
});
