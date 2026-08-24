import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../infrastructure/auth/getCurrentUser';
import { MainNav } from './nav';
import { ToastProvider } from '../../components/ui/toast-provider';
import { GlobalMovementProvider } from './global-movement-provider';

export const dynamic = 'force-dynamic';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen bg-zinc-50 lg:h-screen lg:overflow-hidden dark:bg-zinc-950">
      <MainNav isLoggedIn={true} email={user.email ?? user.userId} />
      <ToastProvider>
        <GlobalMovementProvider>
          <main className="flex-1 overflow-auto pt-16 p-4 lg:p-8 lg:pt-8">{children}</main>
        </GlobalMovementProvider>
      </ToastProvider>
    </div>
  );
}
