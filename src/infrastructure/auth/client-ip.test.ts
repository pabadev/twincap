import { describe, it, expect } from 'vitest';
import { resolveClientIp, UNKNOWN_IP } from './client-ip';

describe('resolveClientIp (R14-C §5)', () => {
  it('prefers x-real-ip over x-forwarded-for', () => {
    const h = new Headers({
      'x-real-ip': '203.0.113.9',
      'x-forwarded-for': '198.51.100.2, 10.0.0.1',
    });
    expect(resolveClientIp(h)).toBe('203.0.113.9');
  });

  it('falls back to the first x-forwarded-for entry when x-real-ip is absent', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' });
    expect(resolveClientIp(h)).toBe('1.2.3.4');
  });

  it('returns unknown when no headers are present', () => {
    const h = new Headers();
    expect(resolveClientIp(h)).toBe(UNKNOWN_IP);
  });

  it('strips the IPv4-mapped IPv6 prefix (::ffff:)', () => {
    const h = new Headers({ 'x-real-ip': '::ffff:192.168.1.10' });
    expect(resolveClientIp(h)).toBe('192.168.1.10');
  });

  it('strips an IPv4 port', () => {
    const h = new Headers({ 'x-real-ip': '1.2.3.4:8080' });
    expect(resolveClientIp(h)).toBe('1.2.3.4');
  });

  it('strips a bracketed IPv6 port', () => {
    const h = new Headers({ 'x-real-ip': '[::1]:8080' });
    expect(resolveClientIp(h)).toBe('::1');
  });

  it('trims whitespace around the value', () => {
    const h = new Headers({ 'x-real-ip': '  203.0.113.9  ' });
    expect(resolveClientIp(h)).toBe('203.0.113.9');
  });

  it('returns unknown for an empty string value', () => {
    const h = new Headers({ 'x-real-ip': '   ' });
    expect(resolveClientIp(h)).toBe(UNKNOWN_IP);
  });
});