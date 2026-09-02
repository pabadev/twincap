import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * i18n usage coverage: every statically referenced translation key must
 * EXIST in both message catalogs (HR3-06). The parity test alone only
 * checks ES↔EN symmetry — a key referenced by UI code but missing from
 * BOTH files (like the original Categories.type bug) passed unnoticed.
 *
 * Detection strategy: find every `useT('<Namespace>')` / `getT('<Namespace>')`
 * binding in source files, then every literal first-argument call of the
 * bound identifier (`t('key', …)`). Dynamic keys (variables, template
 * literals) are skipped gracefully — they cannot be verified statically.
 */

type JsonCatalog = Record<string, Record<string, string>>;

interface TBinding {
  variable: string;
  namespace: string;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !/\.(test|spec)\.(ts|tsx)$/.test(entry)
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Remove block and line comments so doc-comment examples are not scanned. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

/** Extract `useT('Ns')` / `getT('Ns')` bindings from source text. */
export function extractBindings(source: string): TBinding[] {
  const bindings: TBinding[] = [];
  const bindingRe =
    /(?:const|let)\s+(\w+)\s*(?::[^=]+?)?=\s*(?:await\s+)?(?:useT|getT)\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = bindingRe.exec(source)) !== null) {
    bindings.push({ variable: match[1], namespace: match[2] });
  }
  return bindings;
}

/** Extract literal-keyed calls of bound translation functions. */
export function extractCalls(
  source: string,
  bindings: TBinding[],
): { namespace: string; key: string }[] {
  const refs: { namespace: string; key: string }[] = [];
  const variables = [...new Set(bindings.map((b) => b.variable))];
  if (variables.length === 0) return refs;

  const callRe = new RegExp(
    `\\b(${variables.join('|')})\\(\\s*['"]([\\w-]+)['"]\\s*[,)]`,
    'g',
  );
  const nsByVar = new Map(bindings.map((b) => [b.variable, b.namespace]));
  let match: RegExpExecArray | null;
  while ((match = callRe.exec(source)) !== null) {
    const ns = nsByVar.get(match[1]);
    if (ns) refs.push({ namespace: ns, key: match[2] });
  }
  return refs;
}

function loadCatalog(path: string): JsonCatalog {
  return JSON.parse(readFileSync(path, 'utf-8')) as JsonCatalog;
}

describe('i18n usage coverage', () => {
  // Base dir of this file is src/i18n/ → src tree is one level up.
  const srcDir = fileURLToPath(new URL('..', import.meta.url));
  const messagesDir = fileURLToPath(new URL('../../messages/', import.meta.url));

  // Scanner self-check: proves the detector catches a planted missing key
  // (the exact class of bug behind HR3-06).
  describe('scanner self-check', () => {
    it('detects a referenced-but-missing key', () => {
      const fixture = [
        'const t = useT("Categories");',
        'const label = t("type");',
        'const other = t("title");',
        'const dyn = t(someVariable);',
        'const tpl = t(`${prefix}key`);',
      ].join('\n');
      const catalog: JsonCatalog = { Categories: { title: 'Categorías' } };
      const bindings = extractBindings(fixture);
      const refs = extractCalls(fixture, bindings);

      const missing = refs.filter(
        (r) => !(r.key in (catalog[r.namespace] ?? {})),
      );
      expect(refs.map((r) => r.key)).toEqual(['type', 'title']);
      expect(missing).toEqual([
        { namespace: 'Categories', key: 'type' },
      ]);
    });
  });

  it(
    'every statically referenced key exists in es.json AND en.json',
    () => {
      const es = loadCatalog(join(messagesDir, 'es.json'));
      const en = loadCatalog(join(messagesDir, 'en.json'));

    const files = listSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);

    const problems: string[] = [];
    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf-8'));
      const bindings = extractBindings(source);
      if (bindings.length === 0) continue;

      for (const ref of extractCalls(source, bindings)) {
        const relative = file.replace(srcDir, '');
        if (!(ref.namespace in es)) {
          problems.push(
            `${relative}: namespace "${ref.namespace}" missing in es.json`,
          );
          continue;
        }
        if (!(ref.namespace in en)) {
          problems.push(
            `${relative}: namespace "${ref.namespace}" missing in en.json`,
          );
          continue;
        }
        if (!(ref.key in es[ref.namespace])) {
          problems.push(
            `${relative}: ${ref.namespace}.${ref.key} missing in es.json`,
          );
        }
        if (!(ref.key in en[ref.namespace])) {
          problems.push(
            `${relative}: ${ref.namespace}.${ref.key} missing in en.json`,
          );
        }
      }
    }

    expect(problems, problems.join('\n')).toEqual([]);
    },
    // Filesystem walk + scan of the whole src tree; generous budget for
    // slow CI disks.
    30_000,
  );
});
