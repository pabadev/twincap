"use client";

import { useActionState } from "react";
import { useT } from "../../../i18n/client";
import { useActionError } from "../../../lib/use-action-error";
import { PasswordInput } from "../../../components/ui/password-input";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { resetPasswordAction } from "../actions";

export function ResetPasswordForm({ email, token }: { email: string; token: string }) {
  const t = useT("Auth");
  const translateError = useActionError();
  const [state, formAction, isPending] = useActionState(resetPasswordAction, null);

  return (
    <>
      <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {t("resetPassword")}
      </h2>
      <form action={formAction} className="mt-8 space-y-5">
        {state?.success && <Alert variant="success">{t("passwordReset")}</Alert>}
        {state?.error && (
          <Alert variant="danger">{translateError(state.error, t("invalidResetToken"))}</Alert>
        )}
        {!state?.success && (
          <>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="token" value={token} />
            <PasswordInput
              id="newPassword"
              name="newPassword"
              label={t("newPasswordLabel")}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={isPending}
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isPending}
              loading={isPending}
            >
              {isPending ? t("loading") : t("resetPasswordCta")}
            </Button>
          </>
        )}
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          {t("hasAccount")}{" "}
          <a
            href="/login"
            className="font-medium text-primary hover:text-primary-hover dark:text-primary"
          >
            {t("signInLabel")}
          </a>
        </p>
      </form>
    </>
  );
}
