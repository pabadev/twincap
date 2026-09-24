"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "../../../../i18n/client";
import { useActionError } from "../../../../lib/use-action-error";
import { createSaleAction } from "./actions";
import { IdempotencyField } from "../../../../components/ui/idempotency-field";
import { ClientForm } from "../../clients/client-form";
import { CatalogForm } from "../catalog/catalog-form";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import type { SerializedAccount } from "../../../../core/domain/account";
import type { SerializedClient } from "../../../../core/domain/client";
import type { PaymentMode } from "../../../../core/domain/sale";
import { PAYMENT_MODES } from "../../../../core/domain/sale";
import { DEFAULT_CURRENCY } from "../../../../core/domain/currency";
import type { Currency } from "../../../../core/domain/currency";
import { Input } from "../../../../components/ui/input";
import { FormField } from "../../../../components/ui/form-field";
import { Alert } from "../../../../components/ui/alert";
import { Select } from "../../../../components/ui/select";
import { Button } from "../../../../components/ui/button";
import { ActionIconButton } from "../../../../components/ui/action-icon-button";
import { Modal } from "../../../../components/ui/modal";
import { Trash2 } from "lucide-react";
import { useToast } from "../../../../lib/hooks/use-toast";
import { formatAmount } from "../../../../lib/format";
import { toDateInputValue } from "../../../../lib/date";

interface LineItem {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

interface SaleFormProps {
  catalogItems: SerializedCatalogItem[];
  accounts: SerializedAccount[];
  clients: SerializedClient[];
  /** Called after a successful create (sale persisted). Also used as the legacy close path. */
  onDone?: () => void;
  /**
   * Called when the user explicitly cancels (Cancel Button). The parent wires
   * this to the dirty-check close-guard so unsaved changes trigger a
   * confirmation instead of silent discard. Falls back to `onDone` when omitted.
   */
  onCancel?: () => void;
  /**
   * Optional ref the form writes its current dirty flag to, synchronously after
   * each state change. The parent reads it in the close-guard handler to decide
   * whether to show a confirmation. Avoids a callback round-trip and stale
   * closures in the parent's event handler.
   */
  dirtyRef?: MutableRefObject<boolean>;
}

/**
 * C12-3b: format a numeric value with thousands separators for display.
 * Uses Intl.NumberFormat with the current locale. Returns empty string for
 * non-finite values to avoid rendering "NaN" or "Infinity".
 */
function formatNumberDisplay(value: number, locale: string): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * C12-3b: parse a numeric input defensively. Strips non-numeric characters
 * except digits, decimal point, and minus sign. Handles pasted formatted
 * input (e.g. "30.000" or "30,000.50"). Returns NaN if parsing fails.
 */
function parseNumericInput(raw: string): number {
  // Strip everything except digits, decimal point, minus sign
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  // Handle multiple decimal points (keep only the first)
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    const integer = parts[0];
    const decimals = parts.slice(1).join("");
    const parsed = Number(`${integer}.${decimals}`);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * C12-3c: normalize a string for fuzzy-ish search matching. Lowercases,
 * strips diacritics, collapses whitespace. Used by the combobox to filter
 * catalog items as the user types.
 */
function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function SaleForm({
  catalogItems,
  accounts,
  clients,
  onDone,
  onCancel,
  dirtyRef,
}: SaleFormProps) {
  const [state, formAction, isPending] = useActionState(createSaleAction, null);
  const t = useT("Sales");
  const tCommon = useT("Common");
  const tCatalog = useT("Catalog");
  const tToast = useT("Toast");
  const tError = useT("error");
  // I8: createSaleAction returns error.* i18n keys — resolve them here.
  const translateError = useActionError();
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  // A1 (F2+F3): the client <Select> options must come from a LOCAL copy of
  // `clients`, not the prop directly. The prop is a one-shot snapshot from
  // the parent (either the /sales page or the FAB's cached posData in
  // global-movement-provider.tsx); after handleClientCreated the new client
  // never enters the prop, so the select would not list it. A local state
  // tracks locally added clients; the final options merge prop + local.
  const [localClients, setLocalClients] = useState<SerializedClient[]>([]);
  const clientOptions = useMemo(() => {
    // Merge prop clients with locally added ones, deduping by id.
    const map = new Map<string, SerializedClient>();
    for (const c of clients) map.set(c.id, c);
    for (const c of localClients) map.set(c.id, c);
    return Array.from(map.values());
  }, [clients, localClients]);

  // C12-3d: same pattern as localClients — the `catalogItems` prop is a
  // one-shot snapshot from the parent (provider cache or page data). When the
  // user creates a new catalog item from inside the form, the prop does NOT
  // update until the modal is closed and reopened. A local state tracks
  // locally created items; the effective list merges prop + local so the
  // searcher dropdown and the table's name lookup include the new item
  // immediately (no page refresh, no stale-cache row with empty name/price).
  const [localCatalogItems, setLocalCatalogItems] = useState<SerializedCatalogItem[]>([]);
  const effectiveCatalogItems = useMemo(() => {
    const map = new Map<string, SerializedCatalogItem>();
    for (const item of catalogItems) map.set(item.id, item);
    for (const item of localCatalogItems) map.set(item.id, item);
    return Array.from(map.values());
  }, [catalogItems, localCatalogItems]);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      router.refresh();
      onDone?.();
    }
  }, [state?.success, addToast, tToast, router, onDone]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), "error");
    }
  }, [state?.error, addToast, translateError]);

  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("paid-in-full");
  const [clientId, setClientId] = useState<string>(""); // empty = general client
  const [initialPayment, setInitialPayment] = useState<string>("0");
  const [showClientForm, setShowClientForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  // C12-3c: start with an empty cart. The user adds items via the top search.
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // C12-3b: track which unit price input is focused (for format-on-blur).
  // When focused, show raw value; when blurred, show formatted value.
  const [focusedPriceIdx, setFocusedPriceIdx] = useState<number | null>(null);

  // C12-3c: combobox state for the top item searcher.
  const [searchQuery, setSearchQuery] = useState("");
  const [isComboOpen, setIsComboOpen] = useState(false);
  const [comboActiveIdx, setComboActiveIdx] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const comboListRef = useRef<HTMLUListElement>(null);

  // Filtered catalog items based on search query. Excludes items already in
  // the cart (the user can still increment qty via the same selection, but
  // the dropdown only shows items NOT yet in the cart to avoid confusion —
  // selecting an already-added item still works via the duplicate logic).
  // Actually, per spec: selecting an item already in the table increments qty.
  // So we show ALL catalog items in the dropdown, but mark which are in-cart.
  const filteredItems = useMemo(() => {
    const q = normalizeForSearch(searchQuery);
    if (!q) return effectiveCatalogItems;
    return effectiveCatalogItems.filter((item) => normalizeForSearch(item.name).includes(q));
  }, [effectiveCatalogItems, searchQuery]);

  // C12-3c: dirty detection — the form has unsaved changes when any field
  // deviates from its initial value. Initial state is an empty cart, default
  // payment mode, no client, default currency, zero initial payment.
  const isDirty = useMemo(() => {
    if (lineItems.length > 0) return true;
    if (clientId !== "") return true;
    if (paymentMode !== "paid-in-full") return true;
    if (currency !== DEFAULT_CURRENCY) return true;
    if (initialPayment !== "0") return true;
    if (localClients.length > 0) return true;
    return false;
  }, [lineItems, clientId, paymentMode, currency, initialPayment, localClients]);

  // Sync dirty flag to the parent-owned ref so the close-guard handler can
  // read it without stale-closure issues.
  useEffect(() => {
    if (dirtyRef) dirtyRef.current = isDirty;
  }, [isDirty, dirtyRef]);

  // Quick-create from inside the sale form: auto-select the new entity so the
  // user can keep building the sale without leaving the form. A1 (F2+F3):
  // also append the new client to the local option list so it becomes
  // selectable immediately (the prop snapshot would not include it).
  function handleClientCreated(client?: SerializedClient) {
    setShowClientForm(false);
    if (client) {
      setLocalClients((prev) => {
        if (prev.some((c) => c.id === client.id)) return prev;
        return [...prev, client];
      });
      setClientId(client.id);
    }
  }

  // C12-3c + C12-3d: when a new catalog item is created from inside the form,
  // register it in the local catalog state (so the searcher options include it
  // immediately) AND add it to the cart (auto-select, POS pattern). The
  // returned snapshot from createCatalogItemAction carries name/price/currency;
  // if any required field is missing, refuse to render a broken row — fail
  // loudly in development so the bug is visible, skip silently in production.
  function handleItemCreated(item?: SerializedCatalogItem) {
    setShowItemForm(false);
    if (!item) return;
    const hasName = typeof item.name === "string" && item.name.length > 0;
    const hasPrice =
      item.unitPrice != null &&
      typeof item.unitPrice.amount === "number" &&
      Number.isFinite(item.unitPrice.amount);
    if (!hasName || !hasPrice) {
      if (process.env.NODE_ENV === "development") {
        throw new Error(
          `Created catalog item is missing required fields (name=${hasName}, price=${hasPrice})`,
        );
      }
      return;
    }
    setLocalCatalogItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
    addToCart(item);
    setCurrency(item.unitPrice.currency);
    // Clear the search so the combobox is ready for the next item.
    setSearchQuery("");
  }

  const updateLineItem = useCallback(
    (index: number, field: keyof LineItem, value: string | number) => {
      setLineItems((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
      );
    },
    [],
  );

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  // C12-3c: add an item to the cart. If it's already there, increment qty.
  // Otherwise append a new row with qty=1 and the catalog unit price.
  function addToCart(item: SerializedCatalogItem) {
    setLineItems((prev) => {
      const existing = prev.findIndex((li) => li.itemId === item.id);
      if (existing >= 0) {
        return prev.map((li, idx) =>
          idx === existing ? { ...li, quantity: li.quantity + 1 } : li,
        );
      }
      return [...prev, { itemId: item.id, quantity: 1, unitPrice: item.unitPrice.amount }];
    });
    setCurrency(item.unitPrice.currency);
  }

  // C12-3c: combobox handlers.
  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setIsComboOpen(true);
    setComboActiveIdx(-1);
  }

  function handleSearchFocus() {
    if (searchQuery.length > 0 || effectiveCatalogItems.length > 0) {
      setIsComboOpen(true);
    }
  }

  function handleSearchBlur() {
    // Delay closing so click on option can register.
    setTimeout(() => setIsComboOpen(false), 150);
  }

  function selectComboItem(item: SerializedCatalogItem) {
    addToCart(item);
    // Keep the dropdown open so the user can keep adding items (POS pattern).
    // Clear the search so the full catalog is shown for the next selection.
    setSearchQuery("");
    setComboActiveIdx(-1);
    // Return focus to the search input for the next item.
    searchInputRef.current?.focus();
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isComboOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsComboOpen(true);
        setComboActiveIdx(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setComboActiveIdx((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setComboActiveIdx((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (comboActiveIdx >= 0 && comboActiveIdx < filteredItems.length) {
          selectComboItem(filteredItems[comboActiveIdx]);
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        setIsComboOpen(false);
        setComboActiveIdx(-1);
        break;
    }
  }

  // Scroll the active option into view when navigating with arrow keys.
  useEffect(() => {
    if (!isComboOpen || comboActiveIdx < 0) return;
    const list = comboListRef.current;
    if (!list) return;
    const active = list.children[comboActiveIdx] as HTMLElement | undefined;
    // jsdom does not implement scrollIntoView; guard for test environments.
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [comboActiveIdx, isComboOpen]);

  // C12-3b: handle unit price input change with defensive parsing.
  const handlePriceChange = useCallback(
    (idx: number, raw: string) => {
      const parsed = parseNumericInput(raw);
      if (!Number.isNaN(parsed)) {
        updateLineItem(idx, "unitPrice", parsed);
      } else if (raw === "" || raw === "-") {
        // Allow clearing the field temporarily
        updateLineItem(idx, "unitPrice", 0);
      }
    },
    [updateLineItem],
  );

  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  // H14: on-credit sales require a real client and a valid upfront payment.
  const isOnCredit = paymentMode === "on-credit";
  const parsedInitialPayment = Number(initialPayment) || 0;
  const needsClient = isOnCredit && !clientId;
  const initialPaymentInvalid =
    isOnCredit &&
    (!Number.isFinite(parsedInitialPayment) ||
      parsedInitialPayment < 0 ||
      parsedInitialPayment > total);
  const submitBlocked = isPending || needsClient || initialPaymentInvalid;

  // Helper: look up catalog item by id (for displaying name in the table).
  // Uses the effective (merged) catalog so locally created items resolve too.
  const catalogMap = useMemo(() => {
    const map = new Map<string, SerializedCatalogItem>();
    for (const item of effectiveCatalogItems) map.set(item.id, item);
    return map;
  }, [effectiveCatalogItems]);

  return (
    // C12-3f: root fills the modal body completely (h-full). The modal body
    // has overflow-hidden (workspace variant), so this root manages the
    // 3-part flex layout: body (flex-1) + footer (shrink-0).
    // Every flex/grid descendant between dialog and rows-scroll container
    // MUST carry min-h-0 to break the auto-min-height chain.
    <div className="flex h-full flex-col">
      {/* Nested modals MUST live outside the sale <form> — a <form> cannot contain
          another <form>, and browsers would bind the inner controls to the outer
          form, so the create buttons would never submit (no-op). */}
      <form
        action={formAction}
        onSubmit={(e) => {
          if (isPending) {
            e.preventDefault();
            return;
          }
        }}
        /* fixed-region: required min-h-0 chain */
        className="flex min-h-0 flex-1 flex-col"
      >
        <IdempotencyField />
        <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
        {state?.error && <Alert variant="danger">{translateError(state.error)}</Alert>}

        <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="clientId" value={clientId} />

        {/* C12-3f: 2-column work area (body). Mobile: natural flow. Desktop:
            grid with left column (articles) and right column (settings).
            The body fills the remaining space (flex-1 min-h-0) and does NOT
            scroll — internal scroll regions are isolated.
            fixed-region: required min-h-0 chain */}
        <div
          /* fixed-region: required min-h-0 chain */
          className="flex min-h-0 flex-1 flex-col space-y-4 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:overflow-hidden lg:space-y-0"
        >
          {/* Cart / line items.
              Mobile: first section. Desktop: left column.
              C12-3f: on desktop the left column is a flex column that fills
              the available space (min-h-0 so it can shrink). The table rows
              container inside it is the ONLY scroll region for the table.
              fixed-region: required min-h-0 chain */}
          <div
            /* fixed-region: required min-h-0 chain */
            className="flex min-h-0 flex-col lg:overflow-hidden"
          >
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t("lineItems")}
              </label>
            </div>

            {/* C12-3c: single top search combobox. Replaces the per-row <Select>
                dropdowns and the "Agregar artículo" button. Selecting an item
                adds it to the cart (or increments qty if duplicate). */}
            <div className="relative shrink-0">
              <Input
                ref={searchInputRef}
                id="item-search"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("searchOrAddItem")}
                disabled={isPending}
                role="combobox"
                aria-expanded={isComboOpen}
                aria-controls="item-search-listbox"
                aria-activedescendant={
                  comboActiveIdx >= 0 ? `item-search-option-${comboActiveIdx}` : undefined
                }
                aria-autocomplete="list"
                autoComplete="off"
              />
              {isComboOpen && (
                <ul
                  ref={comboListRef}
                  id="item-search-listbox"
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-surface-border bg-surface-card py-1 shadow-lg"
                >
                  {filteredItems.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {t("noItemsFound")}
                    </li>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const inCart = lineItems.some((li) => li.itemId === item.id);
                      const isActive = idx === comboActiveIdx;
                      return (
                        <li
                          key={item.id}
                          id={`item-search-option-${idx}`}
                          role="option"
                          aria-selected={isActive}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectComboItem(item);
                          }}
                          onMouseEnter={() => setComboActiveIdx(idx)}
                          className={`cursor-pointer px-3 py-2 text-sm ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          } ${inCart ? "italic" : ""}`}
                        >
                          <span>{item.name}</span>
                          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                            ({tCatalog(`type_${item.type}`)})
                          </span>
                          {inCart && <span className="ml-2 text-xs text-primary">✓</span>}
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>

            {/* C12-3c + C12-3h: discreet "+ Crear nuevo artículo" link near the searcher.
                C12-3h: blue (text-primary) to match "Crear cliente" link style. */}
            <div className="mt-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowItemForm(true)}
                disabled={isPending}
                className="text-xs font-medium text-primary hover:text-primary-hover hover:underline dark:text-primary dark:hover:text-primary-hover"
              >
                {t("createNewItem")}
              </button>
            </div>

            {/* C12-3c + C12-3e: table of selected items. Mobile: stacked card
                layout with aria-labels on inputs. Desktop: grid-based table
                with sticky header and scroll-isolated rows container. */}
            {lineItems.length > 0 && (
              // C12-3f: table wrapper fills the remaining left-column space
              // (flex-1 min-h-0). On desktop it's a flex column with the
              // header outside the scroll container and the rows container
              // scrolling internally (overflow-y-auto overflow-x-hidden).
              // fixed-region: required min-h-0 chain
              <div
                /* fixed-region: required min-h-0 chain */
                className="mt-4 flex min-h-0 flex-1 flex-col lg:overflow-hidden"
                data-testid="table-wrapper"
              >
                {/* C12-3f + C12-3g + C12-3h: Desktop table header — hidden on mobile, visible on desktop.
                    Kept OUTSIDE the scroll container (sibling, not sticky) so it's
                    always visible. Grid template matches rows exactly. C12-3g: widened
                    last column (44px → 48px) to reserve room for the vertical scrollbar.
                    C12-3h: column alignment matches content — Artículo left, Cant. centered
                    (over centered input), Precio unitario/Subtotal right-aligned (over
                    right-aligned monetary cells). "Acciones" header removed (empty 48px
                    cell, column reserved for trash icon only). */}
                <div
                  className="hidden shrink-0 items-center gap-2 border-b border-surface-border pb-2 text-xs font-medium text-zinc-600 lg:grid lg:grid-cols-[2fr_60px_110px_110px_48px] dark:text-zinc-400"
                  aria-hidden="true"
                >
                  <div className="min-w-0">{t("item")}</div>
                  <div className="text-center">{t("qty")}</div>
                  <div className="text-right">{t("unitPrice")}</div>
                  <div className="text-right">{t("subtotal")}</div>
                  <div></div>
                </div>

                {/* C12-3f + C12-3g: Table rows container — scroll-isolated on desktop.
                    fixed-region: required min-h-0 chain. C12-3g: pr-2 on the scroll
                    container reserves room for the vertical scrollbar so the header
                    and rows stay in lockstep (same grid template). */}
                <div
                  /* fixed-region: required min-h-0 chain */
                  className="flex-1 min-h-0 space-y-3 overflow-y-auto overflow-x-hidden pr-2 lg:space-y-0"
                  data-testid="table-rows-container"
                >
                  {lineItems.map((li, idx) => {
                    const item = catalogMap.get(li.itemId);
                    // C12-3d: defensive — a row without a resolved catalog item
                    // would render empty name/price. Skip it (the local catalog
                    // state should always include items added to the cart).
                    if (!item) return null;
                    const itemName = item.name;
                    const itemType = item.type;
                    const subtotal = li.quantity * li.unitPrice;
                    const isPriceFocused = focusedPriceIdx === idx;
                    const priceDisplay = isPriceFocused
                      ? li.unitPrice.toString()
                      : formatNumberDisplay(li.unitPrice, locale);

                    return (
                      <div
                        key={li.itemId}
                        className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 border-b border-surface-border/50 py-1.5 last:border-b-0 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:gap-x-3 lg:grid lg:grid-cols-[2fr_60px_110px_110px_48px] lg:items-center lg:gap-2 lg:border-b lg:border-surface-border/50 lg:py-2 lg:last:border-b-0"
                      >
                        {/* Item name — plain text (no dropdown) */}
                        <div className="min-w-0 flex-1 lg:min-w-0">
                          {/* Mobile: show item name as title */}
                          <div className="text-sm font-medium text-zinc-900 lg:hidden dark:text-white">
                            {itemName}
                            {itemType && (
                              <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                                ({tCatalog(`type_${itemType}`)})
                              </span>
                            )}
                          </div>
                          {/* Desktop: plain text in table cell */}
                          <div className="hidden min-w-0 truncate text-sm text-zinc-700 lg:block dark:text-zinc-300">
                            {itemName}
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="w-16 sm:w-20 lg:w-auto">
                          <label
                            htmlFor={`qty-${idx}`}
                            className="mb-1 block text-xs text-zinc-500 lg:hidden dark:text-zinc-400"
                          >
                            {t("qty")}
                          </label>
                          <Input
                            id={`qty-${idx}`}
                            type="number"
                            min="1"
                            value={li.quantity}
                            onChange={(e) =>
                              updateLineItem(idx, "quantity", Number(e.target.value))
                            }
                            disabled={isPending}
                            className="text-center sm:text-right"
                            aria-label={itemName ? `${t("qty")} ${itemName}` : t("qty")}
                          />
                        </div>

                        {/* Unit price — format on blur */}
                        <div className="w-24 sm:w-28 lg:w-auto">
                          <label
                            htmlFor={`price-${idx}`}
                            className="mb-1 block text-xs text-zinc-500 lg:hidden dark:text-zinc-400"
                          >
                            {t("unitPrice")}
                          </label>
                          <Input
                            id={`price-${idx}`}
                            type="text"
                            inputMode="decimal"
                            value={priceDisplay}
                            onChange={(e) => handlePriceChange(idx, e.target.value)}
                            onFocus={() => setFocusedPriceIdx(idx)}
                            onBlur={() => setFocusedPriceIdx(null)}
                            disabled={isPending}
                            className="text-right"
                            aria-label={itemName ? `${t("unitPrice")} ${itemName}` : t("unitPrice")}
                          />
                        </div>

                        {/* Subtotal — formatted text, right-aligned */}
                        <div className="hidden w-24 text-right text-sm text-zinc-700 sm:block sm:w-28 lg:w-auto lg:text-right dark:text-zinc-300">
                          {formatAmount(subtotal, currency, locale)}
                        </div>
                        {/* Mobile subtotal */}
                        <div className="text-right text-sm font-medium text-zinc-700 lg:hidden dark:text-zinc-300">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t("subtotal")}:{" "}
                          </span>
                          {formatAmount(subtotal, currency, locale)}
                        </div>

                        {/* Remove button */}
                        <ActionIconButton
                          icon={Trash2}
                          label={t("remove")}
                          tone="neutral"
                          onClick={() => removeLineItem(idx)}
                          disabled={isPending}
                          className="text-zinc-400 hover:text-danger hover:bg-danger/10 dark:text-zinc-500 dark:hover:text-danger dark:hover:bg-danger/20"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Settings: payment, account, client, initial payment, date.
              Mobile: second section. Desktop: right column.
              C12-3f: on desktop the right column is FIXED (no scroll).
              C12-3g: compact vertical rhythm (text-xs labels, h-9 inputs,
              space-y-2) so all fields fit inside 90vh at 650px-tall laptop
              viewports (1366×653). No scroll on this column.
              fixed-region: required min-h-0 chain */}
          <div
            /* fixed-region: required min-h-0 chain */
            className="min-h-0 space-y-2 overflow-hidden lg:pr-2"
            data-testid="right-column"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:gap-2">
              <Select
                id="paymentMode"
                name="paymentMode"
                label={t("paymentMode")}
                labelClassName="text-xs"
                className="h-9"
                required
                disabled={isPending}
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                options={PAYMENT_MODES.map((m) => ({
                  value: m,
                  label: m === "paid-in-full" ? t("paidInFull") : t("onCredit"),
                }))}
              />

              <Select
                id="accountId"
                name="accountId"
                label={t("account")}
                labelClassName="text-xs"
                className="h-9"
                required
                disabled={isPending}
                placeholder={tCommon("select")}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
              />
            </div>

            <div>
              <div className="mb-0 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowClientForm(true)}
                  disabled={isPending}
                  className="text-xs font-medium text-primary hover:text-primary-hover dark:text-primary dark:hover:text-primary-hover"
                >
                  {t("createClient")}
                </button>
              </div>
              <FormField
                id="clientId"
                label={t("client")}
                labelClassName="text-xs"
                hint={needsClient ? t("clientRequiredForCredit") : undefined}
                // C12-3e + C12-3g: amber-500 (#F59E0B) for legibility over dark bg.
                // Font size 0.825rem per spec, mt-1 (4px), display:block (default for <p>).
                // C12-3g: FormField now skips default text-zinc-500 when hintClassName
                // is provided, so amber-500 wins (no gray override from base classes).
                hintClassName={
                  needsClient ? "text-amber-500 text-[0.825rem] font-medium" : undefined
                }
              >
                <Select
                  className="h-9"
                  required={isOnCredit}
                  disabled={isPending}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  options={[
                    { value: "", label: t("generalClient") },
                    ...clientOptions.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                />
              </FormField>
            </div>

            {isOnCredit && (
              <FormField
                id="initialPayment"
                label={`${t("initialPayment")} (${currency})`}
                labelClassName="text-xs"
                error={
                  initialPaymentInvalid
                    ? parsedInitialPayment > total
                      ? t("initialPaymentExceedsTotal")
                      : tError("invalidData")
                    : undefined
                }
              >
                <Input
                  className="h-9"
                  name="initialPayment"
                  type="number"
                  min="0"
                  required
                  disabled={isPending}
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(e.target.value)}
                />
              </FormField>
            )}

            <Input
              id="date"
              name="date"
              type="date"
              label={t("date")}
              labelClassName="text-xs"
              className="h-9"
              required
              disabled={isPending}
              defaultValue={toDateInputValue()}
              max={toDateInputValue()}
            />
          </div>
        </div>

        {/* C12-3f + C12-3g + C12-3h: footer pinned at the bottom of the modal. ONE single
            row: Total (left of buttons) + Cancelar + Crear venta. Compact padding
            (py-3 px-4) keeps height minimal (~52px). Shrink-0 + z-10 + bg match
            the modal surface. Border-top uses themed surface-border.
            C12-3h: Total right-aligned to sit above the subtotal column (pr compensation
            for the actions column width + gap). */}
        <div
          className="relative z-10 flex shrink-0 items-center justify-end gap-3 border-t border-surface-border bg-surface-card px-4 py-3"
          data-testid="sale-footer"
        >
          {/* C12-3b + C12-3g + C12-3h: TOTAL inline with the action buttons (single visual
              line). whitespace-nowrap prevents wrap at 1180px width. C12-3h: pr-[56px]
              compensates for the actions column (48px) + gap (8px) so the Total right-aligns
              with the subtotal column's right edge. */}
          <div className="whitespace-nowrap pr-[56px] text-base font-semibold text-zinc-900 dark:text-white">
            {t("total")} {formatAmount(total, currency, locale)}
          </div>

          {/* C12-3b: footer action row — Cancelar secondary + Crear venta primary.
              Both go through the same guarded path (C12-1). */}
          {(onDone || onCancel) && (
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={onCancel ?? onDone}
            >
              {tCommon("cancel")}
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={submitBlocked} loading={isPending}>
            {isPending ? t("creating") : t("createSale")}
          </Button>
        </div>
      </form>

      <Modal
        open={showClientForm}
        onClose={() => setShowClientForm(false)}
        title={t("newClient")}
        size="sm"
      >
        <ClientForm onSuccess={handleClientCreated} />
      </Modal>

      <Modal
        open={showItemForm}
        onClose={() => setShowItemForm(false)}
        title={t("newItem")}
        size="sm"
      >
        <CatalogForm onDone={handleItemCreated} />
      </Modal>
    </div>
  );
}
