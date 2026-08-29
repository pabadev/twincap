import { describe, expect, it } from "vitest";
import type { Movement, MovementContext } from "../domain/movement";
import {
  countsTowardEconomicResult,
  FINANCING_CAPITAL_LINK_KINDS,
  NON_ECONOMIC_LINK_KINDS,
} from "./economic-result";

type LinkKind = NonNullable<Movement["link"]>["kind"];

/** Minimal movement-shaped object exposing link + context. */
function mv(kind: LinkKind, context?: MovementContext): Pick<Movement, "link" | "context"> {
  return {
    link: { kind, refId: "ref-1", opId: "op-1" },
    context,
  };
}

describe("economic-result contract (R9/D9.2)", () => {
  it("creditGrantedAbono standalone (Personal) does NOT count toward economic result", () => {
    expect(countsTowardEconomicResult(mv("creditGrantedAbono", "Personal"))).toBe(false);
  });

  it("creditGrantedAbono neutral (undefined context) does NOT count", () => {
    expect(countsTowardEconomicResult(mv("creditGrantedAbono"))).toBe(false);
  });

  it("creditGrantedAbono POS initial payment (Business) DOES count", () => {
    expect(countsTowardEconomicResult(mv("creditGrantedAbono", "Business"))).toBe(true);
  });

  it("creditGrantedAbonoInterest counts as economic result", () => {
    expect(countsTowardEconomicResult(mv("creditGrantedAbonoInterest"))).toBe(true);
  });

  it("creditGrantedWriteOff counts as economic result", () => {
    expect(countsTowardEconomicResult(mv("creditGrantedWriteOff"))).toBe(true);
  });

  it("salePayment still counts", () => {
    expect(countsTowardEconomicResult(mv("salePayment", "Business"))).toBe(true);
  });

  it("internal flows and opening balances stay excluded", () => {
    expect(countsTowardEconomicResult(mv("transfer"))).toBe(false);
    expect(countsTowardEconomicResult(mv("opening"))).toBe(false);
  });

  it("financing principals stay excluded but remain in the financing set", () => {
    expect(countsTowardEconomicResult(mv("creditReceivedPrincipal"))).toBe(false);
    expect(countsTowardEconomicResult(mv("creditGrantedPrincipal"))).toBe(false);
    expect(FINANCING_CAPITAL_LINK_KINDS.has("creditReceivedPrincipal" as never)).toBe(true);
    expect(FINANCING_CAPITAL_LINK_KINDS.has("creditGrantedPrincipal" as never)).toBe(true);
  });

  it("creditGrantedAbono is listed in NON_ECONOMIC_LINK_KINDS for the standalone case", () => {
    expect(NON_ECONOMIC_LINK_KINDS.has("creditGrantedAbono" as never)).toBe(true);
  });

  it("received credit abonos and payable payments still count", () => {
    expect(countsTowardEconomicResult(mv("creditReceivedAbono"))).toBe(true);
    expect(countsTowardEconomicResult(mv("payableInitialPayment"))).toBe(true);
    expect(countsTowardEconomicResult(mv("payableAbono"))).toBe(true);
  });
});
