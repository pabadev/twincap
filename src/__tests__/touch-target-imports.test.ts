import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf-8");

describe("TouchTarget structural imports (RTT-1/RTT-2)", () => {
  it("ActionIconButton imports and renders TouchTarget", () => {
    const source = read("src/components/ui/action-icon-button.tsx");
    expect(source).toContain("import { TouchTarget } from './touch-target';");
    expect(source).toContain("<TouchTarget");
  });

  it("BackButton imports and renders TouchTarget", () => {
    const source = read("src/components/ui/back-button.tsx");
    expect(source).toContain("import { TouchTarget } from './touch-target';");
    expect(source).toContain("<TouchTarget");
  });

  it("nav imports and renders TouchTarget for hamburger, close and links", () => {
    const source = read("src/app/(main)/nav.tsx");
    expect(source).toContain("import { TouchTarget } from '../../components/ui/touch-target';");
    expect(source).toContain("<TouchTarget");
  });
});
