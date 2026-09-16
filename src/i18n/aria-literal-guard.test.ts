import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * H-03 literal aria-label guard (R-17): any literal `aria-label="..."` /
 * `aria-label='...'` in src/components or src/app fails the suite.
 *
 * Accessible names MUST come from the i18n catalogs — dynamic expressions
 * (`aria-label={t('key')}`) are the only allowed form, so localized UI stays
 * language-complete. The theme toggle is already i18n (`2960206`).
 *
 * Detection strategy: same scanner style as messages-usage.test.ts — walk the
 * source tree, strip block/line comments, and flag every `aria-label` whose
 * value starts with a quote (a hardcoded literal) instead of `{` (a dynamic
 * expression). Test/spec files are excluded for the same reason as the usage
 * scanner: the guard protects shipped UI; test fixtures may legitimately use
 * literals.
 */

/** Remove block and line comments so doc-comment examples are not scanned. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

/** Find hardcoded `aria-label="..."` / `aria-label='...'` literals. */
export function findLiteralAriaLabels(source: string): string[] {
  const out: string[] = [];
  // Lookbehind excludes data-aria-label / foo-aria-label attributes.
  const literalRe = /(?<!-)aria-label\s*=\s*['"][^'"]*['"]/g;
  let match: RegExpExecArray | null;
  while ((match = literalRe.exec(source)) !== null) {
    out.push(match[0]);
  }
  return out;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("H-03 literal aria-label guard", () => {
  // Base dir of this file is src/i18n/ → src tree is one level up.
  const srcDir = fileURLToPath(new URL("..", import.meta.url));
  const roots = ["components", "app"];

  describe("scanner self-check", () => {
    it("detects a planted literal aria-label (R-17 scenario)", () => {
      const fixture = [
        '<button aria-label="Close">x</button>',
        "<button aria-label='Menu'>y</button>",
        'const icon = <IconButton aria-label={tCommon("edit")} />;',
        'const dashed = <span data-aria-label="hidden">z</span>;',
        '<div aria-labelledby="title">w</div>',
        '// aria-label="commented out" is stripped first',
      ].join("\n");

      const hits = findLiteralAriaLabels(stripComments(fixture));
      expect(hits).toEqual(['aria-label="Close"', "aria-label='Menu'"]);
      // Dynamic expressions (`aria-label={...}`), data attributes and
      // aria-labelledby must never be flagged.
      expect(hits.length).toBe(2);
    });
  });

  // Filesystem walk + scan of the whole src tree; generous budget for
  // slow CI disks.
  it("finds no literal aria-label in src/components or src/app", () => {
    const files = roots.flatMap((root) => listSourceFiles(join(srcDir, root)));
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const cleaned = stripComments(readFileSync(file, "utf-8"));
      for (const hit of findLiteralAriaLabels(cleaned)) {
        violations.push(`${file.replace(srcDir, "")}: ${hit}`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  }, 30_000);
});
