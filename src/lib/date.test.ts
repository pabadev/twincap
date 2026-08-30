import { describe, expect, it } from "vitest";
import {
  businessDateToInputValue,
  toDateInputValue,
  isFutureBusinessDate,
  assertBusinessDateNotFuture,
} from "./date";
import { ValidationError } from "../core/domain/errors";

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

describe("isFutureBusinessDate", () => {
  it("allows the client's current civil date", () => {
    // 2026-08-29T02:00Z with UTC-5: client civil date is 2026-08-28.
    expect(
      isFutureBusinessDate(new Date("2026-08-28"), 300, new Date("2026-08-29T02:00:00Z")),
    ).toBe(false);
  });

  it("rejects a date after the client's civil date", () => {
    expect(
      isFutureBusinessDate(new Date("2026-08-29"), 300, new Date("2026-08-29T02:00:00Z")),
    ).toBe(true);
  });

  it("allows today for users east of UTC during local early morning", () => {
    // 2026-08-29T23:30Z with UTC+1: client civil date is already 2026-08-30.
    expect(
      isFutureBusinessDate(new Date("2026-08-30"), -60, new Date("2026-08-29T23:30:00Z")),
    ).toBe(false);
    expect(
      isFutureBusinessDate(new Date("2026-08-31"), -60, new Date("2026-08-29T23:30:00Z")),
    ).toBe(true);
  });

  it("allows any past date", () => {
    expect(
      isFutureBusinessDate(new Date("2026-01-01"), 0, new Date("2026-08-29T12:00:00Z")),
    ).toBe(false);
  });
});

describe("assertBusinessDateNotFuture", () => {
  it("throws ValidationError for a future business date", () => {
    expect(() =>
      assertBusinessDateNotFuture(
        new Date("2026-08-30"),
        300,
        new Date("2026-08-29T02:00:00Z"),
      ),
    ).toThrow(ValidationError);
  });

  it("does not throw for the client's current civil date", () => {
    expect(() =>
      assertBusinessDateNotFuture(
        new Date("2026-08-28"),
        300,
        new Date("2026-08-29T02:00:00Z"),
      ),
    ).not.toThrow();
  });
});
