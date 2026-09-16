import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// RSL-1 / RSL-7: the app shell layouts must carry the exact viewport-relative
// width class. Below lg (<1024px) the `lg:` variant is inert, so mobile and
// tablet behavior is unchanged (RSL-4). At >=1024px the shell measures
// min(1536px, 100vw - 3rem): 24px guaranteed margin per side on 1024-1536px
// viewports (1366px -> 1318px, RSL-2) and the 1536px cap above 1568px (RSL-3).
const SHELL_WIDTH_CLASS = "lg:max-w-[min(1536px, calc(100vw - 3rem))]";

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
