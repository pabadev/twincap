import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// RSL-1 / RSL-7, amended by beta round 3 (product decision 2026-09-22): the
// viewport-relative cap only applies at >=1536px (2xl). At 1200/1366 the shell
// uses the FULL available width (24px side margins removed); above that the
// min(1536px, 100vw - 3rem) cap keeps huge monitors centered (RSL-3).
// NOTE (Tailwind v4): underscores stand for spaces in the CSS declaration —
// raw spaces produce an unmatchable class token (HTML splits on whitespace).
const SHELL_WIDTH_CLASS = "2xl:max-w-[min(1536px,calc(100vw_-_3rem))]";

const SHELL_LAYOUTS = ["src/app/(main)/layout.tsx", "src/app/(analytics)/layout.tsx"];

for (const file of SHELL_LAYOUTS) {
  describe(`viewport-relative shell width in ${file}`, () => {
    const source = readFileSync(resolve(process.cwd(), file), "utf-8");

    it("carries the exact RSL-1 width class on the shell div (RSL-7)", () => {
      expect(source).toContain(SHELL_WIDTH_CLASS);
    });

    it("no longer uses the fixed max-w-screen-2xl cap", () => {
      expect(source).not.toContain("max-w-screen-2xl");
    });
  });
}
