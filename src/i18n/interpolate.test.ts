import { describe, it, expect } from 'vitest';
import { interpolate } from './interpolate';

describe('interpolate', () => {
  it('replaces a single placeholder', () => {
    expect(interpolate('Capital ({currency})', { currency: 'COP' })).toBe(
      'Capital (COP)',
    );
  });

  it('replaces multiple placeholders', () => {
    expect(
      interpolate('{from} → {to}', { from: 'USD', to: 'COP' }),
    ).toBe('USD → COP');
  });

  it('returns original string when no placeholders', () => {
    expect(interpolate('Hello world', {})).toBe('Hello world');
  });

  it('leaves unmatched placeholders as-is', () => {
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}');
  });

  it('handles empty string', () => {
    expect(interpolate('', { x: 'y' })).toBe('');
  });
});
