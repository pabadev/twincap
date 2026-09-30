"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../i18n/client";
import { CATEGORY_TYPES } from "../../../core/domain/category";
import { createCategoryAction } from "./actions";
import type { SerializedCategory } from "../../../core/domain/category";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";

export function CategoryForm({
  onSuccess,
}: {
  /** Called after a successful create with the new category snapshot (when available). */
  onSuccess?: (category?: SerializedCategory) => void;
}) {
  const [state, formAction, isPending] = useActionState(createCategoryAction, null);
  const t = useT("Categories");
  const tCommon = useT("Common");
  const tToast = useT("Toast");
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      router.refresh();
      onSuccess?.(state.category);
    }
  }, [state?.success, state?.category, addToast, tToast, router, onSuccess]);

  // U1 error one-shot guard (`use-action-error.ts` note): `translateError`
  // identity is unstable after `router.refresh()` (messages re-import per RSC
  // request), so while the same error stays in `state` this effect could
  // re-fire and stack toasts. Memoize per error VALUE: a toast fires once
  // per distinct error; re-submitting and getting a DIFFERENT one still
  // shows. Same class as the sibling `successShownRef` guards.
  const lastErrorShownRef = useRef<string | null>(null);

  useEffect(() => {
    if (state?.error && state.error !== lastErrorShownRef.current) {
      lastErrorShownRef.current = state.error;
      addToast(translateError(state.error), "error");
    }
  }, [state?.error, addToast, translateError]);

  return (
    <form action={formAction} className="space-y-4">
      <Input
        id="name"
        name="name"
        type="text"
        label={t("categoryName")}
        required
        disabled={isPending}
      />

      <Select
        id="type"
        name="type"
        label={t("type")}
        required
        disabled={isPending}
        placeholder={tCommon("select")}
        options={CATEGORY_TYPES.map((ct) => ({
          value: ct,
          label: ct === "income" ? t("income") : t("expense"),
        }))}
      />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t("creating") : t("createCategory")}
      </Button>
    </form>
  );
}
