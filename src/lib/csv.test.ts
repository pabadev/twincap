import { describe, expect, it } from 'vitest';
import { buildCsv, minorUnitsToDecimal } from './csv';

describe('buildCsv', () => {
  it('prepends a UTF-8 BOM', () => {
    const csv = buildCsv(['A'], [['1']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('joins lines with CRLF after the BOM', () => {
    const csv = buildCsv(['A', 'B'], [['1', '2'], ['3', '4']]);
    expect(csv).toBe('\uFEFFA,B\r\n1,2\r\n3,4');
  });

  it('wraps fields containing commas in quotes', () => {
    const csv = buildCsv(['A'], [['hello, world']]);
    expect(csv).toBe('\uFEFFA\r\n"hello, world"');
  });

  it('doubles internal double quotes inside quoted fields', () => {
    const csv = buildCsv(['A'], [['say "hi"']]);
    expect(csv).toBe('\uFEFFA\r\n"say ""hi"""');
  });

  it('wraps fields containing a newline in quotes', () => {
    const csv = buildCsv(['A'], [['line1\nline2']]);
    expect(csv).toBe('\uFEFFA\r\n"line1\nline2"');
  });

  it('wraps fields containing a carriage return in quotes', () => {
    const csv = buildCsv(['A'], [['line1\rline2']]);
    expect(csv).toBe('\uFEFFA\r\n"line1\rline2"');
  });

  it('handles empty rows (headers only)', () => {
    const csv = buildCsv(['A', 'B'], []);
    expect(csv).toBe('\uFEFFA,B');
  });

  it('leaves plain fields unquoted', () => {
    const csv = buildCsv(['A'], [['plain']]);
    expect(csv).toBe('\uFEFFA\r\nplain');
  });
});

describe('minorUnitsToDecimal', () => {
  it('renders COP (exponent 0) without decimals', () => {
    expect(minorUnitsToDecimal(15000, 'COP')).toBe('15000');
  });

  it('renders USD (exponent 2) fixing two decimals', () => {
    expect(minorUnitsToDecimal(12345, 'USD')).toBe('123.45');
    expect(minorUnitsToDecimal(15000, 'USD')).toBe('150.00');
  });

  it('renders MXN and EUR with two decimals', () => {
    expect(minorUnitsToDecimal(999, 'MXN')).toBe('9.99');
    expect(minorUnitsToDecimal(999, 'EUR')).toBe('9.99');
  });

  it('falls back to exponent 2 for unknown currencies', () => {
    expect(minorUnitsToDecimal(1234, 'XYZ')).toBe('12.34');
  });

  it('keeps negative amounts negative', () => {
    expect(minorUnitsToDecimal(-15000, 'COP')).toBe('-15000');
    expect(minorUnitsToDecimal(-12345, 'USD')).toBe('-123.45');
  });

  it('renders zero fixed to the exponent', () => {
    expect(minorUnitsToDecimal(0, 'USD')).toBe('0.00');
    expect(minorUnitsToDecimal(0, 'COP')).toBe('0');
  });
});