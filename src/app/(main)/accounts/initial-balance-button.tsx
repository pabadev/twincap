"use client";

import { Button } from "../../../components/ui/button";
import { TouchTarget } from "../../../components/ui/touch-target";
import { useT } from "../../../i18n/client";
import { useBalanceDialog } from "./balance-dialogs";

/**
 * Row trigger (2026-10-05): the dialog no longer lives here — it is hosted
 * at list level by BalanceDialogsProvider, whose fibers survive the RSC row
 * swaps that a server action response re-renders (see balance-dialogs.tsx).
 */
export function InitialBalanceButton({
  accountId,
  currency,
}: {
  accountId: string;
  currency?: string;
}) {
  const t = useT("Accounts");
  const { open } = useBalanceDialog();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => open({ accountId, currency, mode: "set" })}
    >
      {/* TouchTarget expands the Button sm hit area to >=44px (RTT-1). */}
      <TouchTarget as="span">{t("setInitialBalance")}</TouchTarget>
    </Button>
  );
}
