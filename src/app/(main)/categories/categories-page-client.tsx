"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../i18n/client";
import { CategoryForm } from "./category-form";
import { Modal } from "../../../components/ui/modal";
import { Button } from "../../../components/ui/button";
import { Icon } from "../../../components/ui/icon";
import { Check } from "lucide-react";
import { CATEGORY_SUGGESTIONS } from "../../../core/application/categories/category-suggestions";
import { createSuggestedCategoriesAction } from "./actions";

export function CategoriesPageClient({
  existing,
}: {
  /** Current workspace categories — lets the suggestion modal mark the presets
   *  the user already added as "already added" (beta feedback #10, reworked
   *  from disabled checkboxes to static rows per founder feedback). */
  existing: { name: string; type: "income" | "expense" }[];
}) {
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

  // Same duplicate criterion as createSuggestedCategories (exact trimmed name
  // + type), resolved against the CURRENT locale's suggestion labels.
  const existingKeys = new Set(existing.map((c) => `${c.type}:${c.name.trim()}`));
  const preChecked = new Set(
    CATEGORY_SUGGESTIONS.filter((s) => existingKeys.has(`${s.type}:${t(s.labelKey).trim()}`)).map(
      (s) => s.id,
    ),
  );
  const allSuggestionsExist = preChecked.size === CATEGORY_SUGGESTIONS.length;

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
          {allSuggestionsExist ? (
            <p role="status" className="text-sm text-green-700 dark:text-green-400">
              {t("suggestedAllExist")}
            </p>
          ) : (
            (["income", "expense"] as const).map((type) => (
              <fieldset key={type} disabled={isSuggestionPending}>
                <legend className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
                  {t(type)}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CATEGORY_SUGGESTIONS.filter((suggestion) => suggestion.type === type).map(
                    (suggestion) => {
                      const alreadyExists = preChecked.has(suggestion.id);
                      // Existing suggestions are NOT rendered as a (disabled)
                      // checkbox: a locked control reads as "choice frozen".
                      // Beta feedback: users thought existing categories could
                      // no longer be edited/deleted. Show a static row instead
                      // — edit/delete/add lives in the page list.
                      if (alreadyExists) {
                        return (
                          <div
                            key={suggestion.id}
                            className="flex min-h-10 items-center justify-between gap-2 rounded-md border border-zinc-200 bg-surface-header px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-surface-card/60 dark:text-zinc-100"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="text-green-600 dark:text-green-400"
                              >
                                <Icon icon={Check} size="sm" />
                              </span>
                              <span>{t(suggestion.labelKey)}</span>
                            </span>
                            <span className="whitespace-nowrap text-xs font-medium text-green-700 dark:text-green-400">
                              {t("suggestionAlreadyExists")}
                            </span>
                          </div>
                        );
                      }
                      return (
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
                      );
                    },
                  )}
                </div>
              </fieldset>
            ))
          )}
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
          {!allSuggestionsExist && (
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isSuggestionPending}
            >
              {isSuggestionPending ? t("suggestedAdding") : t("suggestedSubmit")}
            </Button>
          )}
        </form>
      </Modal>
    </>
  );
}
