import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { isCanonicalPhoneE164, normalizePhoneE164 } from "./client-phone";

describe("normalizePhoneE164", () => {
  it("canonicalizes a formatted international phone", () => {
    expect(normalizePhoneE164("+57 300 123 4567")).toBe("+573001234567");
    expect(normalizePhoneE164("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it.each(["", "300 123 4567", "+0 3001234567", "+57 abc 300", "+1234567890123456"])(
    "rejects an invalid international phone: %s",
    (phone) => {
      expect(() => normalizePhoneE164(phone)).toThrow(ValidationError);
    },
  );

  it("distinguishes canonical values from values that need normalization", () => {
    expect(isCanonicalPhoneE164("+573001234567")).toBe(true);
    expect(isCanonicalPhoneE164("+57 300 123 4567")).toBe(false);
    expect(isCanonicalPhoneE164("legacy-value")).toBe(false);
  });
});
