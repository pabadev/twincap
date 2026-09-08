import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '../../infrastructure/auth/getCurrentUser';
import { DefaultAnalyticsAuthorizer } from '../../infrastructure/auth/analytics-authorizer';
import { MainNav } from '../(main)/nav';
import { ToastProvider } from '../../components/ui/toast-provider';

export const dynamic = 'force-dynamic';

/**
 * Analytics route group layout (R14-O hardening).
 *
 * The analytics module lives OUTSIDE the (main) group on purpose: when an
 * unauthorized user hits /analytics, this layout calls notFound() BEFORE
 * MainNav renders, so the 404 is indistinguishable from any nonexistent
 * route (no sidebar, no hint that the module exists). Inside the (main)
 * group, the layout would render first and the 404 would show the app
 * sidebar — an enumeration hint.
 *
 *   - not logged in  -> redirect /login
 *   - not authorized -> notFound()  (opaque, no app shell)
 *   - authorized     -> app shell (MainNav) + analytics page
 */
export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const authorizer = new DefaultAnalyticsAuthorizer();
  const allowed = await authorizer.canView(user.userId, user.email ?? '');
  if (!allowed) notFound();

  return (
    <div className="flex min-h-screen bg-surface-bg lg:h-screen lg:overflow-hidden dark:bg-zinc-950">
      <MainNav isLoggedIn={true} email={user.email ?? user.userId} canViewAnalytics={true} />
      <ToastProvider>
        <main className="flex-1 overflow-auto pt-16 p-4 lg:p-8 lg:pt-8 max-w-screen-2xl mx-auto">{children}</main>
      </ToastProvider>
    </div>
  );
}