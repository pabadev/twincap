import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { connectDb } from "../../../infrastructure/db/connection";
import { MongoUserRepository } from "../../../infrastructure/repositories/user-repository";
import { getT, getLocale } from "../../../i18n/server";
import { ProfileForm } from "./profile-form";
import { VerifyBanner } from "./verify-banner";
import { listActiveGrantsForUser } from "@/infrastructure/mcp/oauth-service";
import { McpConnections } from "./mcp-connections";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  const t = await getT("Profile");
  const locale = await getLocale();

  await connectDb();
  const userRepo = new MongoUserRepository();
  const user = await userRepo.findById(authUser.userId);
  if (!user) redirect("/login");

  const snapshot = user.toJSON();
  const grants = await listActiveGrantsForUser(authUser.userId);

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
      {snapshot.emailVerified === false && (
        <VerifyBanner
          title={t("emailNotVerified")}
          description={t("emailNotVerifiedHint")}
          resend={t("resendVerification")}
        />
      )}
      <ProfileForm
        name={snapshot.name ?? ""}
        email={snapshot.email}
        locale={snapshot.locale ?? locale}
        defaultCurrency={snapshot.defaultCurrency}
        translations={{
          name: t("name"),
          namePlaceholder: t("namePlaceholder"),
          email: t("email"),
          language: t("language"),
          defaultCurrency: t("defaultCurrency"),
          defaultCurrencyHint: t("defaultCurrencyHint"),
          saveProfile: t("saveProfile"),
          profileSaved: t("profileSaved"),
          changePassword: t("changePassword"),
          currentPassword: t("currentPassword"),
          newPassword: t("newPassword"),
          confirmNewPassword: t("confirmNewPassword"),
          passwordChanged: t("passwordChanged"),
          wrongPassword: t("wrongPassword"),
          passwordMismatch: t("passwordMismatch"),
          cancel: (await getT("Common"))("cancel"),
        }}
      />
      <McpConnections
        grants={grants.map((grant) => ({
          id: String(grant._id),
          clientName: grant.clientName,
          capabilities: grant.capabilities,
          consentedAt: grant.consentedAt.toLocaleString(locale),
          lastUsedAt: grant.lastUsedAt?.toLocaleString(locale) ?? null,
        }))}
        labels={{
          title: t("mcpTitle"),
          description: t("mcpDescription"),
          none: t("mcpNone"),
          granted: t("mcpGranted"),
          lastUsed: t("mcpLastUsed"),
          revoke: t("mcpRevoke"),
          revokeAll: t("mcpRevokeAll"),
          permission: t("mcpPermission"),
          summaryRead: t("mcpSummaryRead"),
        }}
      />
    </div>
  );
}
