/**
 * Transactional email HTML templates (R13-B / post-B fix).
 *
 * Design constraints:
 * - Table-based layout (email client compatibility)
 * - Inline styles only (most clients strip <style> tags)
 * - Logo hosted publicly via APP_BASE_URL
 * - CTA button as table cell ( Outlook compatibility )
 * - i18n: locale-driven copy via static translations (no React/Next.js i18n)
 */

const BRAND = {
  primary: '#4f46e5', // indigo-600
  primaryDark: '#4338ca', // indigo-700
  bg: '#f9fafb', // gray-50
  card: '#ffffff',
  text: '#111827', // gray-900
  muted: '#6b7280', // gray-500
  border: '#e5e7eb', // gray-200
};

/* ── i18n ─────────────────────────────────────────────────────────── */

type Locale = 'es' | 'en';

const t: Record<Locale, {
  verifySubject: string;
  verifyTitle: string;
  verifyBody: string;
  verifyButton: string;
  verifyExpiry: string;
  verifyIgnore: string;
  resetSubject: string;
  resetTitle: string;
  resetBody: string;
  resetButton: string;
  resetExpiry: string;
  resetIgnore: string;
  footerTagline: string;
  footerIgnore: string;
}> = {
  es: {
    verifySubject: 'Verifica tu correo de TwinCap',
    verifyTitle: 'Verifica tu correo',
    verifyBody: 'Bienvenido a TwinCap. Confirma tu direcci\u00f3n de correo para comenzar a administrar tus finanzas.',
    verifyButton: 'Verificar correo',
    verifyExpiry: 'Este enlace vence en 48 horas.',
    verifyIgnore: 'Si no creaste una cuenta en TwinCap, puedes ignorar este mensaje.',
    resetSubject: 'Restablece tu contrase\u00f1a de TwinCap',
    resetTitle: 'Restablece tu contrase\u00f1a',
    resetBody: 'Recibimos una solicitud para restablecer tu contrase\u00f1a de TwinCap. Haz clic en el bot\u00f3n de abajo para elegir una nueva.',
    resetButton: 'Restablecer contrase\u00f1a',
    resetExpiry: 'Este enlace vence en 1 hora.',
    resetIgnore: 'Si no solicitaste este cambio, puedes ignorar este mensaje.',
    footerTagline: 'TwinCap \u2014 Finanzas personales y de negocio',
    footerIgnore: 'Si no solicitaste este mensaje, puedes ignorarlo sin problema.',
  },
  en: {
    verifySubject: 'Verify your TwinCap email',
    verifyTitle: 'Verify your email',
    verifyBody: 'Welcome to TwinCap. Confirm your email address to start managing your finances.',
    verifyButton: 'Verify email address',
    verifyExpiry: 'This link expires in 48 hours.',
    verifyIgnore: "If you didn't create a TwinCap account, you can ignore this email.",
    resetSubject: 'Reset your TwinCap password',
    resetTitle: 'Reset your password',
    resetBody: 'We received a request to reset your TwinCap password. Click the button below to choose a new one.',
    resetButton: 'Reset password',
    resetExpiry: 'This link expires in 1 hour.',
    resetIgnore: "If you didn't request this, you can safely ignore this email.",
    footerTagline: 'TwinCap \u2014 Personal & business finances',
    footerIgnore: "If you didn't request this email, you can safely ignore it.",
  },
};

function resolveLocale(locale?: string): Locale {
  return locale === 'en' ? 'en' : 'es';
}

/* ── HTML helpers ──────────────────────────────────────────────────── */

function wrap(body: string, baseUrl: string, locale?: string): string {
  const L = t[resolveLocale(locale)];
  const logoUrl = `${baseUrl}/isotipo-twincap.png`;
  return `<!DOCTYPE html>
<html lang="${resolveLocale(locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:${BRAND.card};border-radius:12px;border:1px solid ${BRAND.border};overflow:hidden;">
  <!-- Header -->
  <tr><td align="center" style="padding:32px 32px 0;">
    <img src="${logoUrl}" alt="TwinCap" width="48" height="48" style="display:block;border-radius:8px;" />
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:24px 32px 32px;">
${body}
  </td></tr>
</table>
<!-- Footer -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
<tr><td style="padding:16px 32px;text-align:center;font-size:12px;color:${BRAND.muted};line-height:1.5;">
  ${L.footerTagline}<br/>
  ${L.footerIgnore}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function btn(url: string, label: string): string {
  return `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="10%" strokecolor="${BRAND.primary}" fillcolor="${BRAND.primary}"><w:anchorlock/><center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!-->
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
  <td style="background-color:${BRAND.primary};border-radius:8px;">
    <a href="${url}" target="_blank" style="display:inline-block;padding:12px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:sans-serif;">${label}</a>
  </td>
</tr></table>
<!--<![endif]-->`;
}

/* ── Exported templates ────────────────────────────────────────────── */

export function verificationEmail(
  baseUrl: string,
  link: string,
  locale?: string,
): { subject: string; html: string } {
  const L = t[resolveLocale(locale)];
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${BRAND.text};text-align:center;">${L.verifyTitle}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.text};text-align:center;line-height:1.6;">
      ${L.verifyBody}
    </p>
    ${btn(link, L.verifyButton)}
    <p style="margin:24px 0 0;font-size:13px;color:${BRAND.muted};text-align:center;line-height:1.5;">
      ${L.verifyExpiry}<br/>
      ${L.verifyIgnore}
    </p>`;

  return {
    subject: L.verifySubject,
    html: wrap(body, baseUrl, locale),
  };
}

export function passwordResetEmail(
  baseUrl: string,
  link: string,
  locale?: string,
): { subject: string; html: string } {
  const L = t[resolveLocale(locale)];
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${BRAND.text};text-align:center;">${L.resetTitle}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.text};text-align:center;line-height:1.6;">
      ${L.resetBody}
    </p>
    ${btn(link, L.resetButton)}
    <p style="margin:24px 0 0;font-size:13px;color:${BRAND.muted};text-align:center;line-height:1.5;">
      ${L.resetExpiry}<br/>
      ${L.resetIgnore}
    </p>`;

  return {
    subject: L.resetSubject,
    html: wrap(body, baseUrl, locale),
  };
}
