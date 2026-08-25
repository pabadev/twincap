import { describe, expect, it } from 'vitest';
import {
  filterCategoriesByType,
  resolveDefaultAccountId,
} from './movement-form';
import type { SerializedAccount } from '../core/domain/account';
import type { SerializedCategory } from '../core/domain/category';

const accounts: SerializedAccount[] = [
  { id: 'acc-1', userId: 'user-1', name: 'Efectivo', currency: 'COP', isFixed: true, scope: 'Personal', createdAt: new Date('2026-01-01') },
  { id: 'acc-2', userId: 'user-1', name: 'Nequi', currency: 'COP', isFixed: true, scope: 'Personal', createdAt: new Date('2026-01-02') },
];

function makeCategory(id: string, type: SerializedCategory['type']): SerializedCategory {
  return { id, userId: 'user-1', name: `cat-${id}`, type, createdAt: new Date('2026-01-01') };
}

describe('resolveDefaultAccountId', () => {
  it('returns undefined for the "all" filter', () => {
    expect(resolveDefaultAccountId('all', accounts)).toBeUndefined();
  });

  it('returns undefined when no filter is active', () => {
    expect(resolveDefaultAccountId(undefined, accounts)).toBeUndefined();
    expect(resolveDefaultAccountId('', accounts)).toBeUndefined();
  });

  it('preselects the filtered account when it still exists', () => {
    expect(resolveDefaultAccountId('acc-2', accounts)).toBe('acc-2');
  });

  it('returns undefined for a stale account id not in the list', () => {
    expect(resolveDefaultAccountId('acc-deleted', accounts)).toBeUndefined();
  });

  it('returns undefined when there are no accounts at all', () => {
    expect(resolveDefaultAccountId('acc-1', [])).toBeUndefined();
  });
});

describe('filterCategoriesByType', () => {
  const categories = [
    makeCategory('c1', 'income'),
    makeCategory('c2', 'expense'),
    makeCategory('c3', 'income'),
  ];

  it('keeps only income categories for income movements', () => {
    expect(filterCategoriesByType(categories, 'income').map((c) => c.id)).toEqual(['c1', 'c3']);
  });

  it('keeps only expense categories for expense movements', () => {
    expect(filterCategoriesByType(categories, 'expense').map((c) => c.id)).toEqual(['c2']);
  });

  it('returns an empty array when no categories match', () => {
    expect(filterCategoriesByType([], 'income')).toEqual([]);
  });
});
