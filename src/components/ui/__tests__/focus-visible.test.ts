// UX-12 (navigation-ia): unified focus-visible ring pattern (DS focus rule).
// The ring MUST be drawn on keyboard focus only (focus-visible:), never on
// programmatic/mouse focus (focus:). Reference implementation:
// src/components/ui/action-icon-button.tsx. Structural assertions follow the
// touch-target-imports.test.ts literal-file style — the ring pattern is a
// styling contract of the shared components.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf-8");

// The touched set for the U4 unification unit; button.tsx is canonical.
const FOCUS_TOUCHED_FILES = [
  "src/components/ui/button.tsx",
  "src/components/ui/toast.tsx",
  "src/app/(main)/global-movement-provider.tsx",
  "src/app/not-found.tsx",
];

describe("focus-visible ring unification (DS focus rule, U4)", () => {
  it("Button (canonical) draws the ring on focus-visible with the primary token", () => {
    const source = read(FOCUS_TOUCHED_FILES[0]);
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain("focus-visible:ring-primary");
    expect(source).not.toMatch(/(?:^|[^-:])focus:ring-2/);
  });

  it("no touched component still uses focus:ring-2 (mouse no longer draws a ring)", () => {
    for (const file of FOCUS_TOUCHED_FILES) {
      expect(read(file).match(/focus:ring-2/g), `${file} focus:ring-2 count`).toBeNull();
    }
  });

  it("keyboard focus visibility is preserved everywhere (ring kept on focus-visible)", () => {
    for (const file of FOCUS_TOUCHED_FILES) {
      expect(read(file), `${file} keeps a focus-visible ring`).toContain("focus-visible:ring-2");
    }
  });
});
