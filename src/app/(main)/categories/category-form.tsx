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

  useEffect(() => {
    if (state?.error) {
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
