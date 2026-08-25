import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { syntheticCategoryLabel } from './synthetic-category-label';
import { SYSTEM_NOTES_NAMESPACE, type TranslateFn } from './system-note';
import {
  CREDIT_CATEGORY_ID,
  CREDIT_GRANTED_CATEGORY_ID,
  TRANSFER_CATEGORY_ID,
  SALE_CATEGORY_ID,
  OPENING_CATEGORY_ID,
  PAYABLE_CATEGORY_ID,
} from '../core/domain/synthetic-categories';

function makeT(locale: 'es' | 'en'): TranslateFn {
  const filePath = fileURLToPath(new URL(`../../messages/${locale}.json`, import.meta.url));
  const catalog = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<
    string,
    Record<string, string>
  >;
  return (key) => catalog[SYSTEM_NOTES_NAMESPACE]?.[key] ?? key;
}

const tEs = makeT('es');
const tEn = makeT('en');

describe('syntheticCategoryLabel', () => {
  it('resolves every synthetic id to a localized label', () => {
    const expected: Array<[string, string, string]> = [
      [CREDIT_CATEGORY_ID, 'Crédito', 'Credit'],
      [CREDIT_GRANTED_CATEGORY_ID, 'Crédito otorgado', 'Credit granted'],
      [TRANSFER_CATEGORY_ID, 'Transferencia', 'Transfer'],
      [SALE_CATEGORY_ID, 'Venta', 'Sale'],
      [OPENING_CATEGORY_ID, 'Saldo inicial', 'Opening balance'],
      [PAYABLE_CATEGORY_ID, 'Cuenta por pagar', 'Payable'],
    ];
    for (const [id, es, en] of expected) {
      expect(syntheticCategoryLabel(id, tEs)).toBe(es);
      expect(syntheticCategoryLabel(id, tEn)).toBe(en);
    }
  });

  it('returns undefined for real (non-synthetic) category ids', () => {
    // 24-hex ObjectId-shaped id that is NOT one of the synthetic constants
    expect(syntheticCategoryLabel('64b1f0c2a3d4e5f6a7b8c9d0', tEs)).toBeUndefined();
    expect(syntheticCategoryLabel('', tEs)).toBeUndefined();
  });
});
