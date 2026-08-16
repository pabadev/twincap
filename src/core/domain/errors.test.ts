import { describe, expect, it } from "vitest";
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors";
import { MoneyError } from "./money";

describe("DomainError hierarchy", () => {
  it("DomainError is an Error", () => {
    expect(new DomainError("boom")).toBeInstanceOf(Error);
  });

  it.each([
    ["NotFoundError", NotFoundError],
    ["ForbiddenError", ForbiddenError],
    ["ValidationError", ValidationError],
    ["ConflictError", ConflictError],
  ] as const)("%s extends DomainError and Error with its own name", (_label, ErrorClass) => {
    const error = new ErrorClass("msg");
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(_label);
  });

  it("carries an optional cause", () => {
    const cause = new Error("root cause");
    const error = new DomainError("wrapped", { cause });
    expect(error.cause).toBe(cause);
  });

  it("folds the money module error into the shared hierarchy", () => {
    const error = new MoneyError("Amount must be positive, got 0");
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("MoneyError");
  });
});
