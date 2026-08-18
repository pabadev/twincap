import {NextRequest, NextResponse} from 'next/server';
import {connectDb} from './infrastructure/db/connection';

const DEFAULT_LOCALE = 'es';
const LOCALES = ['es', 'en'];

function getLocaleFromRequest(request: NextRequest): string {
  // 1. Check cookie
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && LOCALES.includes(cookieLocale)) return cookieLocale;

  // 2. Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(',')
      .map((lang) => lang.split(';')[0].trim().substring(0, 2))
      .find((lang) => LOCALES.includes(lang));
    if (preferred) return preferred;
  }

  return DEFAULT_LOCALE;
}

export async function proxy(request: NextRequest) {
  // Ensure DB connection is established before any route handler runs.
  // This prevents the "Cannot call findOne() before initial connection"
  // error on Turbopack cold start.
  await connectDb();

  const locale = getLocaleFromRequest(request);
  const response = NextResponse.next();
  response.headers.set('x-locale', locale);
  response.cookies.set('NEXT_LOCALE', locale, {path: '/', maxAge: 60 * 60 * 24 * 365});
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
