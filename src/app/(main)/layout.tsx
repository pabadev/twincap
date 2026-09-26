import { redirect } from "next/navigation";
import { getCurrentUser } from "../../infrastructure/auth/getCurrentUser";
import { DefaultAnalyticsAuthorizer } from "../../infrastructure/auth/analytics-authorizer";
import { MainNav } from "./nav";
import { ToastProvider } from "../../components/ui/toast-provider";
import { GlobalMovementProvider } from "./global-movement-provider";
import { connectDb } from "../../infrastructure/db/connection";
import { MongoUserRepository } from "../../infrastructure/repositories/user-repository";
import { ConnectivityNotice } from "../../components/connectivity-notice";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  await connectDb();
  const userRepo = new MongoUserRepository();
  const user = await userRepo.findById(authUser.userId);
  if (!user) redirect("/login");

  // R13-G: only users authorized by the analytics policy see the analytics nav
  // item and route. Resolved in the server layout so the client nav stays dumb.
  const authorizer = new DefaultAnalyticsAuthorizer();
  const canViewAnalytics = await authorizer.canView(authUser.userId, authUser.email ?? "");

  return (
    <div className="mx-auto flex min-h-screen w-full bg-surface-bg 2xl:max-w-[min(1536px,calc(100vw_-_3rem))] lg:h-screen lg:overflow-hidden dark:bg-zinc-950">
      <MainNav
        isLoggedIn={true}
        email={authUser.email ?? authUser.userId}
        canViewAnalytics={canViewAnalytics}
      />
      <ToastProvider>
        <GlobalMovementProvider defaultCurrency={user.defaultCurrency}>
          {/* The main fills the full space next to the sidebar; page-level
              ContentContainer(s) cap and center the visual content. */}
          <main className="flex-1 overflow-auto pt-16 p-4 lg:p-8 lg:pt-8">
            <ConnectivityNotice />
            {children}
          </main>
        </GlobalMovementProvider>
      </ToastProvider>
    </div>
  );
}
