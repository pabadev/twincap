import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../infrastructure/auth/getCurrentUser';
import { DefaultAnalyticsAuthorizer } from '../../infrastructure/auth/analytics-authorizer';
import { MainNav } from './nav';
import { ToastProvider } from '../../components/ui/toast-provider';
import { GlobalMovementProvider } from './global-movement-provider';
import { FeedbackWidget } from '../../components/feedback/feedback-widget';

export const dynamic = 'force-dynamic';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // R13-G: only users authorized by the analytics policy see the analytics nav
  // item and route. Resolved in the server layout so the client nav stays dumb.
  const authorizer = new DefaultAnalyticsAuthorizer();
  const canViewAnalytics = await authorizer.canView(
    user.userId,
    user.email ?? '',
  );

  return (
    <div className="flex min-h-screen bg-surface-bg lg:h-screen lg:overflow-hidden dark:bg-zinc-950">
      <MainNav
        isLoggedIn={true}
        email={user.email ?? user.userId}
        canViewAnalytics={canViewAnalytics}
      />
      <ToastProvider>
        <GlobalMovementProvider>
          <main className="flex-1 overflow-auto pt-16 p-4 lg:p-8 lg:pt-8 max-w-screen-2xl mx-auto">{children}</main>
        </GlobalMovementProvider>
      </ToastProvider>
      <FeedbackWidget />
    </div>
  );
}
