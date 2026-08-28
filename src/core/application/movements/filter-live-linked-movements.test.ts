import { describe, it, expect } from 'vitest';
import { filterMovementsWithLiveParents, type LiveParentIds, type LinkableParent } from './filter-live-linked-movements';
import { Movement } from '../../domain/movement';
import { Category } from '../../domain/category';
import { Money } from '../../domain/money';
import type { MovementLinkKind } from '../../domain/movement';

const CAT = new Category({ id: 'cat-1', userId: 'user-1', name: 'Sale', type: 'income', createdAt: new Date() });

function makeMovement(
  kind: MovementLinkKind | undefined,
  refId: string,
  overrides: { accountId?: string; amount?: number; date?: Date } = {},
): Movement {
  return new Movement({
    id: `mov-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1',
    accountId: overrides.accountId ?? 'acc-1',
    category: CAT,
    type: 'income',
    amount: new Money(overrides.amount ?? 50000, 'COP'),
    date: overrides.date ?? new Date('2026-08-28T12:00:00Z'),
    createdAt: new Date(),
    ...(kind
      ? { link: { kind, refId, opId: `op-${refId}` } }
      : {}),
  });
}

function makeLinkable(id: string, accountId: string, amount: number, date: Date): LinkableParent {
  return { id, accountId, date, amount };
}

function allLive(): LiveParentIds {
  return {
    accounts: new Set(['acc-live']),
    transfers: new Set(['tr-live']),
    creditsReceived: [makeLinkable('cr-live', 'acc-1', 30000, new Date('2026-07-01'))],
    creditsGranted: [makeLinkable('cg-live', 'acc-1', 20000, new Date('2026-08-28'))],
    sales: [makeLinkable('sale-live', 'acc-1', 15000, new Date('2026-06-15'))],
    payables: new Set(['pay-live']),
  };
}

describe('filterMovementsWithLiveParents', () => {
  it('keeps a manual movement without a link', () => {
    const manual = makeMovement(undefined, 'n/a');
    const result = filterMovementsWithLiveParents([manual], allLive());
    expect(result).toHaveLength(1);
  });

  it.each([
    ['opening', 'acc-live', 'accounts'],
    ['transfer', 'tr-live', 'transfers'],
    ['payableInitialPayment', 'pay-live', 'payables'],
    ['payableAbono', 'pay-live', 'payables'],
  ] as [MovementLinkKind, string, string][])('keeps %s with a live parent by id', (_kind, refId) => {
    const m = makeMovement(_kind, refId);
    const result = filterMovementsWithLiveParents([m], allLive());
    expect(result).toHaveLength(1);
  });

  it.each([
    ['opening', 'acc-dead', 'accounts'],
    ['transfer', 'tr-dead', 'transfers'],
    ['payableInitialPayment', 'pay-dead', 'payables'],
    ['payableAbono', 'pay-dead', 'payables'],
  ] as [MovementLinkKind, string, string][])('drops %s when its parent is gone', (_kind, refId) => {
    const m = makeMovement(_kind, refId);
    const result = filterMovementsWithLiveParents([m], allLive());
    expect(result).toHaveLength(0);
  });

  it.each([
    ['creditReceivedPrincipal', 'cr-live'],
    ['creditReceivedAbono', 'cr-live'],
    ['creditGrantedPrincipal', 'cg-live'],
    ['creditGrantedAbono', 'cg-live'],
    ['salePayment', 'sale-live'],
  ] as [MovementLinkKind, string][])('keeps %s with a live parent by id', (_kind, refId) => {
    const m = makeMovement(_kind, refId);
    const result = filterMovementsWithLiveParents([m], allLive());
    expect(result).toHaveLength(1);
  });

  it.each([
    ['creditReceivedPrincipal', 'cr-dead'],
    ['creditReceivedAbono', 'cr-dead'],
    ['creditGrantedPrincipal', 'cg-dead'],
    ['creditGrantedAbono', 'cg-dead'],
    ['salePayment', 'sale-dead'],
  ] as [MovementLinkKind, string][])('drops %s when its parent is gone (id)', (_kind, refId) => {
    const m = makeMovement(_kind, refId);
    const result = filterMovementsWithLiveParents([m], allLive());
    expect(result).toHaveLength(0);
  });

  it('keeps live parents and drops orphans in a mixed list', () => {
    const live = allLive();
    const mixed = [
      makeMovement(undefined, 'n/a'),
      makeMovement('salePayment', 'sale-live'),
      makeMovement('salePayment', 'sale-dead'),
      makeMovement('creditGrantedAbono', 'cg-live'),
      makeMovement('creditGrantedAbono', 'cg-dead'),
      makeMovement('transfer', 'tr-live'),
    ];
    const result = filterMovementsWithLiveParents(mixed, live);
    expect(result).toHaveLength(4);
    const survive = result.map((m) => m.link?.refId ?? 'manual');
    expect(survive).toContain('sale-live');
    expect(survive).toContain('cg-live');
    expect(survive).toContain('tr-live');
    expect(survive).toContain('manual');
    expect(survive).not.toContain('sale-dead');
    expect(survive).not.toContain('cg-dead');
  });

  describe('value-based reconciliation (legacy refId)', () => {
    const LEGACY_UUID = '4ba475b5-2f3d-49f6-817b-60c7395ddbd0';

    it('keeps creditGrantedPrincipal with legacy refId when parent matches by value', () => {
      const m = makeMovement('creditGrantedPrincipal', LEGACY_UUID, {
        accountId: 'acc-1',
        amount: 20000,
        date: new Date('2026-08-28T15:30:00Z'),
      });
      const result = filterMovementsWithLiveParents([m], allLive());
      expect(result).toHaveLength(1);
    });

    it('drops creditGrantedPrincipal with legacy refId when no parent matches by value', () => {
      const m = makeMovement('creditGrantedPrincipal', LEGACY_UUID, {
        accountId: 'acc-1',
        amount: 99999,
        date: new Date('2026-08-28'),
      });
      const result = filterMovementsWithLiveParents([m], allLive());
      expect(result).toHaveLength(0);
    });

    it('keeps creditReceivedPrincipal with legacy refId when parent matches by value', () => {
      const LEGACY_UUID_R = '5ca283c6-3e4a-4a07-928c-71d84a6eebe1';
      const m = makeMovement('creditReceivedPrincipal', LEGACY_UUID_R, {
        accountId: 'acc-1',
        amount: 30000,
        date: new Date('2026-07-01T08:00:00Z'),
      });
      const result = filterMovementsWithLiveParents([m], allLive());
      expect(result).toHaveLength(1);
    });

    it('keeps salePayment with legacy refId when parent matches by value', () => {
      const LEGACY_UUID_S = '6db394d7-4f5b-4b18-a39d-82e95b7ffc2a';
      const m = makeMovement('salePayment', LEGACY_UUID_S, {
        accountId: 'acc-1',
        amount: 15000,
        date: new Date('2026-06-15T10:00:00Z'),
      });
      const result = filterMovementsWithLiveParents([m], allLive());
      expect(result).toHaveLength(1);
    });

    it('drops legacy refId when accountId differs', () => {
      const m = makeMovement('creditGrantedPrincipal', LEGACY_UUID, {
        accountId: 'acc-other',
        amount: 20000,
        date: new Date('2026-08-28'),
      });
      const result = filterMovementsWithLiveParents([m], allLive());
      expect(result).toHaveLength(0);
    });

    it('drops legacy refId when date differs', () => {
      const m = makeMovement('creditGrantedPrincipal', LEGACY_UUID, {
        accountId: 'acc-1',
        amount: 20000,
        date: new Date('2026-09-01'),
      });
      const result = filterMovementsWithLiveParents([m], allLive());
      expect(result).toHaveLength(0);
    });

    it('keeps legacy refId when business date matches but time-of-day differs (dateKeyOf)', () => {
      const m = makeMovement('creditGrantedPrincipal', LEGACY_UUID, {
        accountId: 'acc-1',
        amount: 20000,
        date: new Date('2026-08-28T23:59:59Z'),
      });
      const result = filterMovementsWithLiveParents([m], allLive());
      expect(result).toHaveLength(1);
    });

    it('does not reconcile abono kinds by value (creditGrantedAbono with bad refId is dropped)', () => {
      const m = makeMovement('creditGrantedAbono', LEGACY_UUID, {
        accountId: 'acc-1',
        amount: 20000,
        date: new Date('2026-08-28'),
      });
      const result = filterMovementsWithLiveParents([m], allLive());
      expect(result).toHaveLength(0);
    });
  });
});
