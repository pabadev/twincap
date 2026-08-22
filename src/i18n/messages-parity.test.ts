import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type JsonTree = { [key: string]: string | JsonTree };

function loadMessages(relativePath: string): JsonTree {
  const filePath = fileURLToPath(new URL(relativePath, import.meta.url));
  return JSON.parse(readFileSync(filePath, 'utf-8')) as JsonTree;
}

function collectKeys(tree: JsonTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? [fullKey]
      : collectKeys(value, fullKey);
  });
}

describe('i18n message parity', () => {
  const es = loadMessages('../../messages/es.json');
  const en = loadMessages('../../messages/en.json');

  it('es and en expose the exact same nested key set', () => {
    const esKeys = collectKeys(es).sort();
    const enKeys = collectKeys(en).sort();

    expect(enKeys).toEqual(esKeys);
  });

  it('every leaf value is a non-empty string in both locales', () => {
    for (const tree of [es, en]) {
      for (const key of collectKeys(tree)) {
        const value = key.split('.').reduce<unknown>(
          (node, part) =>
            node !== null && typeof node === 'object'
              ? (node as JsonTree)[part]
              : undefined,
          tree,
        );
        expect(typeof value === 'string' && value.length > 0, key).toBe(true);
      }
    }
  });
});
