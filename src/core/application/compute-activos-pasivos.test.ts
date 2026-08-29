import { describe, expect, it } from 'vitest';
import { computeActivosPasivos } from './compute-activos-pasivos';

describe('computeActivosPasivos', () => {
  it('single currency: activos = account balance + credit granted pending', () => {
    const result = computeActivosPasivos({
      accounts: [
        { currency: 'COP', balance: 5_000_000 },
        { currency: 'COP', balance: 1_000_000 },
      ],
      creditsGranted: [
        { principal: { currency: 'COP' }, pending: 500_000 },
      ],
      creditsReceived: [],
      payables: [],
    });

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toEqual({
      currency: 'COP',
      activos: 6_500_000,
      pasivos: 0,
      net: 6_500_000,
    });
  });

  it('written-off credit granted (pending>0) does not add to activos', () => {
    const result = computeActivosPasivos({
      accounts: [{ currency: 'COP', balance: 5_000_000 }],
      creditsGranted: [
        { principal: { currency: 'COP' }, pending: 500_000, writtenOff: true },
      ],
      creditsReceived: [],
      payables: [],
    });

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toEqual({
      currency: 'COP',
      activos: 5_000_000,
      pasivos: 0,
      net: 5_000_000,
    });
  });

  it('credit granted pending>0 without writtenOff still adds to activos', () => {
    const result = computeActivosPasivos({
      accounts: [{ currency: 'COP', balance: 5_000_000 }],
      creditsGranted: [
        { principal: { currency: 'COP' }, pending: 500_000 },
      ],
      creditsReceived: [],
      payables: [],
    });

    expect(result.positions[0].activos).toBe(5_500_000);
  });

  it('written-off credit excluded while a live credit still adds', () => {
    const result = computeActivosPasivos({
      accounts: [{ currency: 'COP', balance: 5_000_000 }],
      creditsGranted: [
        { principal: { currency: 'COP' }, pending: 300_000, writtenOff: true },
        { principal: { currency: 'COP' }, pending: 200_000 },
      ],
      creditsReceived: [],
      payables: [],
    });

    expect(result.positions[0].activos).toBe(5_200_000);
  });

  it('single currency: pasivos = credit received pending + payable pending', () => {
    const result = computeActivosPasivos({
      accounts: [{ currency: 'COP', balance: 2_000_000 }],
      creditsGranted: [],
      creditsReceived: [
        { principal: { currency: 'COP' }, pending: 800_000 },
        { principal: { currency: 'COP' }, pending: 200_000 },
      ],
      payables: [
        { total: { currency: 'COP' }, pending: 300_000 },
      ],
    });

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toEqual({
      currency: 'COP',
      activos: 2_000_000,
      pasivos: 1_300_000,
      net: 700_000,
    });
  });

  it('multi-currency: groups separately', () => {
    const result = computeActivosPasivos({
      accounts: [
        { currency: 'COP', balance: 5_000_000 },
        { currency: 'USD', balance: 500_00 },
      ],
      creditsGranted: [
        { principal: { currency: 'COP' }, pending: 1_000_000 },
        { principal: { currency: 'USD' }, pending: 300_00 },
      ],
      creditsReceived: [
        { principal: { currency: 'USD' }, pending: 200_00 },
      ],
      payables: [
        { total: { currency: 'COP' }, pending: 500_000 },
      ],
    });

    expect(result.positions).toHaveLength(2);

    // COP first (sorted)
    const cop = result.positions.find((p) => p.currency === 'COP')!;
    expect(cop.activos).toBe(6_000_000); // 5M + 1M
    expect(cop.pasivos).toBe(500_000);
    expect(cop.net).toBe(5_500_000);

    // USD second
    const usd = result.positions.find((p) => p.currency === 'USD')!;
    expect(usd.activos).toBe(800_00); // 500 + 300
    expect(usd.pasivos).toBe(200_00);
    expect(usd.net).toBe(600_00);
  });

  it('empty data: returns empty positions array', () => {
    const result = computeActivosPasivos({
      accounts: [],
      creditsGranted: [],
      creditsReceived: [],
      payables: [],
    });

    expect(result.positions).toEqual([]);
  });

  it('zero balances are excluded from positions', () => {
    const result = computeActivosPasivos({
      accounts: [{ currency: 'COP', balance: 0 }],
      creditsGranted: [],
      creditsReceived: [],
      payables: [],
    });

    expect(result.positions).toEqual([]);
  });

  it('fully paid credits (pending=0) do not inflate positions', () => {
    const result = computeActivosPasivos({
      accounts: [{ currency: 'COP', balance: 3_000_000 }],
      creditsGranted: [
        { principal: { currency: 'COP' }, pending: 0 },
      ],
      creditsReceived: [
        { principal: { currency: 'COP' }, pending: 0 },
      ],
      payables: [
        { total: { currency: 'COP' }, pending: 0 },
      ],
    });

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toEqual({
      currency: 'COP',
      activos: 3_000_000,
      pasivos: 0,
      net: 3_000_000,
    });
  });

  it('net can be negative (liabilities exceed assets)', () => {
    const result = computeActivosPasivos({
      accounts: [{ currency: 'COP', balance: 1_000_000 }],
      creditsGranted: [],
      creditsReceived: [
        { principal: { currency: 'COP' }, pending: 500_000 },
        { principal: { currency: 'COP' }, pending: 800_000 },
      ],
      payables: [
        { total: { currency: 'COP' }, pending: 400_000 },
      ],
    });

    expect(result.positions[0].net).toBe(-700_000);
  });

  it('COP is sorted first regardless of insertion order', () => {
    const result = computeActivosPasivos({
      accounts: [
        { currency: 'USD', balance: 100_00 },
        { currency: 'COP', balance: 1_000_000 },
        { currency: 'EUR', balance: 200_00 },
      ],
      creditsGranted: [],
      creditsReceived: [],
      payables: [],
    });

    expect(result.positions[0].currency).toBe('COP');
    expect(result.positions[1].currency).toBe('EUR');
    expect(result.positions[2].currency).toBe('USD');
  });
});
