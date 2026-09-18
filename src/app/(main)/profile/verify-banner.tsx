"use client";

import { useTransition } from "react";
import { useT } from "../../../i18n/client";
import { Button } from "../../../components/ui/button";
import { Alert } from "../../../components/ui/alert";
import { useToast } from "../../../lib/hooks/use-toast";
import { resendVerificationAction } from "./actions";

/**
 * Non-blocking "email not verified" banner (R13-B2). Shown only when the user
 * has an unverified email. The user can log in and use the app regardless;
 * this just offers a way to re-send the verification email.
 */
export function VerifyBanner({
  title,
  description,
  resend,
}: {
  title: string;
  description: string;
  resend: string;
}) {
  const t = useT("Auth");
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleResend() {
    startTransition(async () => {
      const result = await resendVerificationAction();
      if (result.success) addToast(t("verificationSent"), "success");
      else if (result.error === "tooManyAttempts") addToast(t("tooManyAttempts"), "error");
      else addToast(t("errorGeneric"), "error");
    });
  }

  return (
    // Info variant via shared Alert (UX-10 S5): amber → info token palette is
    // a spec-mandated appearance change; copy, trigger and handlers unchanged.
    <Alert
      variant="info"
      title={title}
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={handleResend}
          disabled={isPending}
          loading={isPending}
          className="shrink-0"
        >
          {resend}
        </Button>
      }
    >
      {description}
    </Alert>
  );
}
