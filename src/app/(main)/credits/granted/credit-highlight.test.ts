import { describe, expect, it } from "vitest";
import {
  CREDIT_HIGHLIGHT_DURATION_MS,
  creditHighlightScrollBehavior,
  resolveCreditHighlightTarget,
} from "./credit-highlight";

describe("granted credit highlight", () => {
  it("only resolves an exact credit ID present in the workspace list", () => {
    expect(resolveCreditHighlightTarget("credit-2", ["credit-1", "credit-2"])).toBe("credit-2");
    expect(resolveCreditHighlightTarget("missing", ["credit-1"])).toBeNull();
    expect(resolveCreditHighlightTarget(null, ["credit-1"])).toBeNull();
  });

  it("uses immediate scrolling when reduced motion is preferred", () => {
    expect(creditHighlightScrollBehavior(true)).toBe("auto");
    expect(creditHighlightScrollBehavior(false)).toBe("smooth");
  });

  it("keeps the highlight duration at three seconds", () => {
    expect(CREDIT_HIGHLIGHT_DURATION_MS).toBe(3000);
  });
});
