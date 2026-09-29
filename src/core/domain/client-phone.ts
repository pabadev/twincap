import { ValidationError } from "./errors";

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;
const ALLOWED_FORMATTING = /^[+\d\s().-]+$/;

/** Canonical E.164 storage; users must supply an explicit country calling code. */
export function normalizePhoneE164(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("+") || !ALLOWED_FORMATTING.test(trimmed)) {
    throw new ValidationError("Client phone must use international E.164 format");
  }

  const normalized = `+${trimmed.slice(1).replace(/[\s().-]/g, "")}`;
  if (!E164_PATTERN.test(normalized)) {
    throw new ValidationError("Client phone must use international E.164 format");
  }
  return normalized;
}

export function isCanonicalPhoneE164(input: string): boolean {
  try {
    return normalizePhoneE164(input) === input.trim();
  } catch {
    return false;
  }
}
