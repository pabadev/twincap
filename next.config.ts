import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Static security headers applied to every response.
 *
 * The Content-Security-Policy is intentionally NOT here: it carries a
 * per-request nonce and is therefore emitted from `src/proxy.ts` (run before
 * rendering, per the Next.js CSP guide). Frame protection is enforced via the
 * CSP `frame-ancestors 'none'` directive; X-Frame-Options is deliberately
 * omitted to avoid a duplicated/conflicting clickjacking control.
 */
const securityHeaders: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // Deny-by-default for capabilities the app never uses. clipboard,
    // fullscreen and web-share are intentionally unlisted (allowed) so
    // existing copy and PWA behaviors keep working.
    value:
      'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=(), serial=(), magnetometer=(), gyroscope=(), accelerometer=(), display-capture=(), xr-spatial-tracking=()',
  },
  // HTTPS-only. Matches the NODE_ENV production convention used across the
  // repo (e.g. the locale cookie `secure` flag in src/proxy.ts). `preload` is
  // intentionally omitted: it is a permanent one-way commitment.
  ...(isProduction
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;