import { redirect } from "next/navigation";
import { getCurrentUser } from "../../infrastructure/auth/getCurrentUser";
import { DefaultAnalyticsAuthorizer } from "../../infrastructure/auth/analytics-authorizer";
import { MainNav } from "./nav";
import { ToastProvider } from "../../components/ui/toast-provider";
import { GlobalMovementProvider } from "./global-movement-provider";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // R13-G: only users authorized by the analytics policy see the analytics nav
  // item and route. Resolved in the server layout so the client nav stays dumb.
  const authorizer = new DefaultAnalyticsAuthorizer();
  const canViewAnalytics = await authorizer.canView(user.userId, user.email ?? "");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl bg-surface-bg lg:h-screen lg:overflow-hidden dark:bg-zinc-950">
      <MainNav
        isLoggedIn={true}
        email={user.email ?? user.userId}
        canViewAnalytics={canViewAnalytics}
      />
      <ToastProvider>
        <GlobalMovementProvider>
          {/* The main fills the full space next to the sidebar; page-level
              ContentContainer(s) cap and center the visual content. */}
          <main className="flex-1 overflow-auto pt-16 p-4 lg:p-8 lg:pt-8">{children}</main>
        </GlobalMovementProvider>
      </ToastProvider>
    </div>
  );
}
