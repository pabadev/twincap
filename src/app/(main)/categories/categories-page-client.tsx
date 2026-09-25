"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../i18n/client";
import { CategoryForm } from "./category-form";
import { Modal } from "../../../components/ui/modal";
import { Button } from "../../../components/ui/button";
import { CATEGORY_SUGGESTIONS } from "../../../core/application/categories/category-suggestions";
import { createSuggestedCategoriesAction } from "./actions";

export function CategoriesPageClient() {
  const [showForm, setShowForm] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const t = useT("Categories");
  const router = useRouter();
  const [suggestionState, suggestionAction, isSuggestionPending] = useActionState(
    createSuggestedCategoriesAction,
    null,
  );

  useEffect(() => {
    if (suggestionState?.success) router.refresh();
  }, [suggestionState?.success, router]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setShowSuggestions(true)}>
          {t("suggestedButton")}
        </Button>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          {t("addCategory")}
        </Button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t("addCategory")}>
        <CategoryForm onSuccess={() => setShowForm(false)} />
      </Modal>

      <Modal
        open={showSuggestions}
        onClose={() => setShowSuggestions(false)}
        title={t("suggestedTitle")}
      >
        <form action={suggestionAction} className="space-y-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("suggestedDescription")}</p>
          {(["income", "expense"] as const).map((type) => (
            <fieldset key={type} disabled={isSuggestionPending}>
              <legend className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
                {t(type)}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {CATEGORY_SUGGESTIONS.filter((suggestion) => suggestion.type === type).map(
                  (suggestion) => (
                    <label
                      key={suggestion.id}
                      className="flex min-h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                    >
                      <input
                        type="checkbox"
                        name="suggestionId"
                        value={suggestion.id}
                        className="size-4 accent-blue-600"
                      />
                      <span>{t(suggestion.labelKey)}</span>
                    </label>
                  ),
                )}
              </div>
            </fieldset>
          ))}
          {suggestionState?.success && (
            <p role="status" className="text-sm text-green-700 dark:text-green-400">
              {t("suggestedResult", {
                created: String(suggestionState.created ?? 0),
                skipped: String(suggestionState.skipped ?? 0),
              })}
            </p>
          )}
          {suggestionState?.error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {t("suggestedError")}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" loading={isSuggestionPending}>
            {isSuggestionPending ? t("suggestedAdding") : t("suggestedSubmit")}
          </Button>
        </form>
      </Modal>
    </>
  );
}
