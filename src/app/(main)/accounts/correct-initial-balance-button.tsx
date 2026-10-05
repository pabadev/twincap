"use client";

import { ActionIconButton } from "../../../components/ui/action-icon-button";
import { useT } from "../../../i18n/client";
import { useBalanceDialog } from "./balance-dialogs";
import { RotateCcw } from "lucide-react";

/**
 * Row trigger (2026-10-05): the dialog no longer lives here — it is hosted
 * at list level by BalanceDialogsProvider, whose fibers survive the RSC row
 * swaps that a server action response re-renders (see balance-dialogs.tsx).
 */
export function CorrectInitialBalanceButton({
  accountId,
  currency,
}: {
  accountId: string;
  currency?: string;
}) {
  const t = useT("Accounts");
  const { open } = useBalanceDialog();

  return (
    <ActionIconButton
      icon={RotateCcw}
      label={t("correctInitialBalance")}
      tone="primary"
      onClick={() => open({ accountId, currency, mode: "correct" })}
    />
  );
}
