import { getT } from "../../../i18n/server";
import { loginAction } from "../actions";
import { AuthForm } from "../auth-form";
import { Logo } from "../../../components/ui/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reauth?: string }>;
}) {
  const params = await searchParams;
  const t = await getT("Auth");
  return (
    <>
      <div className="flex justify-center">
        <Logo variant="isotipo" size="lg" />
      </div>
      <AuthForm
        action={loginAction}
        title={params.reauth === "1" ? t("reauthenticate") : t("signIn")}
        description={params.reauth === "1" ? t("reauthenticateHint") : undefined}
        submitLabel={t("signInLabel")}
        alternateText={t("noAccount")}
        alternateHref="/register"
        alternateLabel={t("registerLabel")}
        authMode="login"
        nextUrl={params.next}
        forgotLabel={t("forgotPassword")}
        forgotHref="/forgot-password"
      />
    </>
  );
}
