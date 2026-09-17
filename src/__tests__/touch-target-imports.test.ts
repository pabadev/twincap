import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf-8");

const importOf = (source: string, specifier: string) =>
  new RegExp(`import\\s*\\{[^}]*\\}\\s*from\\s*['"]${escapeRegExp(specifier)}['"];?`).test(source);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("TouchTarget structural imports (RTT-1/RTT-2)", () => {
  it("ActionIconButton imports and renders TouchTarget", () => {
    const source = read("src/components/ui/action-icon-button.tsx");
    expect(importOf(source, "./touch-target")).toBe(true);
    expect(source).toContain("<TouchTarget");
  });

  it("BackButton imports and renders TouchTarget", () => {
    const source = read("src/components/ui/back-button.tsx");
    expect(importOf(source, "./touch-target")).toBe(true);
    expect(source).toContain("<TouchTarget");
  });

  it("nav imports and renders TouchTarget for hamburger, close and links", () => {
    const source = read("src/app/(main)/nav.tsx");
    expect(importOf(source, "../../components/ui/touch-target")).toBe(true);
    expect(source).toContain("<TouchTarget");
  });
});
