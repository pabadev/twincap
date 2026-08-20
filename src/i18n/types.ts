export type Locale = 'es' | 'en';

export const LOCALES: Locale[] = ['es', 'en'];
export const DEFAULT_LOCALE: Locale = 'es';

export type Namespace =
  | 'Common'
  | 'Nav'
  | 'Auth'
  | 'Dashboard'
  | 'Accounts'
  | 'Categories'
  | 'Clients'
  | 'Movements'
  | 'Transfers'
  | 'CreditsReceived'
  | 'CreditsGranted'
  | 'Catalog'
  | 'Sales'
  | 'Metadata'
  | 'Landing';

export type Messages = Record<Namespace, Record<string, string>>;
