"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useT } from "../../i18n/client";
import type { MovementType } from "../../core/domain/movement";
import type { SerializedAccount } from "../../core/domain/account";
import type { SerializedCategory } from "../../core/domain/category";
import type { SerializedCatalogItem } from "../../core/domain/catalog";
import type { SerializedClient } from "../../core/domain/client";
import { listAccountsAction, listCategoriesAction } from "./movements/actions";
import { getSaleFormDataAction } from "./pos/sales/actions";
import { MovementForm } from "./movements/movement-form";
import { SaleForm } from "./pos/sales/sale-form";
import { resolveDefaultAccountId } from "../../lib/movement-form";
import { Modal } from "../../components/ui/modal";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { Icon } from "../../components/ui/icon";
import { Plus, TrendingUp, TrendingDown, X, ShoppingCart } from "lucide-react";

export interface QuickMovementOptions {
  /** Preset movement type so the user starts directly on income or expense. */
  type?: MovementType;
  /** Account preselection (e.g. the active account filter on /movements). */
  accountId?: string;
}

interface GlobalMovementContextValue {
  openQuickMovement: (options?: QuickMovementOptions) => void;
  invalidateData: () => void;
}

const GlobalMovementContext = createContext<GlobalMovementContextValue | null>(null);

export function useQuickMovement(): GlobalMovementContextValue {
  const ctx = useContext(GlobalMovementContext);
  if (!ctx) {
    throw new Error("useQuickMovement must be used within a GlobalMovementProvider");
  }
  return ctx;
}

type LoadState = "idle" | "loading" | "error";

interface FormDataPayload {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
}

interface SaleFormDataPayload {
  catalogItems: SerializedCatalogItem[];
  accounts: SerializedAccount[];
  clients: SerializedClient[];
}

export function GlobalMovementProvider({
  children,
  defaultCurrency,
}: {
  children: ReactNode;
  /** User's preferred currency for new operations. */
  defaultCurrency?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [preset, setPreset] = useState<QuickMovementOptions>({});
  const [posModalOpen, setPosModalOpen] = useState(false);
  const [posData, setPosData] = useState<SaleFormDataPayload | null>(null);
  const [posLoadState, setPosLoadState] = useState<LoadState>("idle");
  const [dialOpen, setDialOpen] = useState(false);
  const [data, setData] = useState<FormDataPayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  // C12-1: close-guard for the POS sale modal — when the form has unsaved
  // changes, ESC/X/backdrop/Cancel show a confirmation instead of discarding.
  const [showPosCloseConfirm, setShowPosCloseConfirm] = useState(false);
  const saleDirtyRef = useRef(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  const tMovements = useT("Movements");
  const tCommon = useT("Common");
  const tSales = useT("Sales");
  const tToast = useT("Toast");
  const tErrors = useT("Errors");

  const openQuickMovement = useCallback((options: QuickMovementOptions = {}) => {
    setPreset(options);
    setDialOpen(false);
    setModalOpen(true);
  }, []);

  // Beta feedback: "Venta POS" must behave like Ingreso/Egreso — open the
  // associated form in place instead of navigating away from the current view.
  const openPosSale = useCallback(() => {
    setDialOpen(false);
    setPosModalOpen(true);
  }, []);

  const closePosModal = useCallback(() => {
    setPosModalOpen(false);
    // §16 pattern: drop cached reference data on close so the next open
    // fetches fresh catalog/accounts/clients.
    setPosData(null);
    setPosLoadState("idle");
    saleDirtyRef.current = false;
  }, []);

  // C12-1: close-guard handler — called by the Modal's ESC/X/backdrop when
  // `onRequestClose` is wired. If the sale form has unsaved changes, show a
  // confirmation; otherwise close directly.
  const handlePosRequestClose = useCallback(() => {
    // If the confirmation is already open, ignore — let it handle its own ESC.
    if (showPosCloseConfirm) return;
    if (saleDirtyRef.current) {
      setShowPosCloseConfirm(true);
    } else {
      closePosModal();
    }
  }, [showPosCloseConfirm, closePosModal]);

  const handlePosConfirmClose = useCallback(() => {
    setShowPosCloseConfirm(false);
    closePosModal();
  }, [closePosModal]);

  const handlePosCancelClose = useCallback(() => {
    setShowPosCloseConfirm(false);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    // §16: invalidate the cached reference data on close so the next open
    // fetches fresh accounts/categories. Without this, a category created
    // elsewhere (e.g. /categories page) would not appear in the FAB form
    // until a full page refresh.
    setData(null);
  }, []);

  useEffect(() => {
    if (!modalOpen || data !== null || loadState === "error") return;
    let active = true;
    void (async () => {
      try {
        const [accounts, categories] = await Promise.all([
          listAccountsAction(),
          listCategoriesAction(),
        ]);
        if (active) setData({ accounts, categories });
      } catch {
        if (active) setLoadState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [modalOpen, data, loadState]);

  useEffect(() => {
    if (!posModalOpen || posData !== null || posLoadState === "error") return;
    let active = true;
    void (async () => {
      try {
        const payload = await getSaleFormDataAction();
        if (active) setPosData(payload);
      } catch {
        if (active) setPosLoadState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [posModalOpen, posData, posLoadState]);

  useEffect(() => {
    if (!dialOpen) return;
    const fab = fabRef.current;
    firstOptionRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDialOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      fab?.focus();
    };
  }, [dialOpen]);

  const invalidateData = useCallback(() => setData(null), []);

  const value = useMemo(
    () => ({ openQuickMovement, invalidateData }),
    [openQuickMovement, invalidateData],
  );

  return (
    <GlobalMovementContext.Provider value={value}>
      {children}

      {/* Floating quick action — speed dial for direct income/expense entry.
          §24: vertical menu spacing kept moderately tight (gap-2 outer,
          gap-1.5 between options) while touch targets stay 44px (h-11). */}
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 flex flex-col items-end gap-2 lg:bottom-8 lg:right-8">
        {dialOpen && (
          <>
            <div className="fixed inset-0" aria-hidden="true" onClick={() => setDialOpen(false)} />
            <div
              id="quick-movement-menu"
              role="group"
              aria-label={tMovements("quickAddMenu")}
              className="relative flex flex-col items-end gap-1.5"
            >
              <button
                ref={firstOptionRef}
                type="button"
                onClick={openPosSale}
                className="flex h-11 min-w-[44px] cursor-pointer items-center gap-2 rounded-full border border-surface-border bg-surface-card px-4 shadow-md hover:bg-surface-input focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                aria-label={tMovements("quickAddPosSale")}
              >
                <Icon icon={ShoppingCart} size="sm" className="text-income" />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {tMovements("quickAddPosSale")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openQuickMovement({ type: "income" })}
                className="flex h-11 min-w-[44px] cursor-pointer items-center gap-2 rounded-full border border-surface-border bg-surface-card px-4 shadow-md hover:bg-surface-input focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                aria-label={tMovements("income")}
              >
                <Icon icon={TrendingUp} size="sm" className="text-income" />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {tMovements("income")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openQuickMovement({ type: "expense" })}
                className="flex h-11 min-w-[44px] cursor-pointer items-center gap-2 rounded-full border border-surface-border bg-surface-card px-4 shadow-md hover:bg-surface-input focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                aria-label={tMovements("expense")}
              >
                <Icon icon={TrendingDown} size="sm" className="text-expense" />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {tMovements("expense")}
                </span>
              </button>
            </div>
          </>
        )}
        <button
          ref={fabRef}
          type="button"
          onClick={() => setDialOpen((v) => !v)}
          aria-expanded={dialOpen}
          aria-controls={dialOpen ? "quick-movement-menu" : undefined}
          aria-label={tMovements("quickAdd")}
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
        >
          <Icon icon={dialOpen ? X : Plus} size="lg" />
        </button>
      </div>

      {/* Shared movement form — single instance pattern for the whole app */}
      <Modal open={modalOpen} onClose={closeModal} title={tMovements("newMovement")} size="lg">
        {loadState === "error" ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{tToast("operationFailed")}</p>
            <button
              type="button"
              onClick={() => setLoadState("idle")}
              className="cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {tErrors("retry")}
            </button>
          </div>
        ) : data === null ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {tCommon("loading")}
          </p>
        ) : data.accounts.length === 0 ? (
          // H-10 EXCLUSION (UX-10): inline contextual hint inside the movement
          // modal, not a list-surface empty state — the centered EmptyState
          // iconography would misrepresent the "account needed first"
          // guidance. See openspec/changes/ux-10-implementation/design.md.
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{tMovements("noAccounts")}</p>
        ) : (
          <MovementForm
            accounts={data.accounts}
            categories={data.categories}
            defaultAccountId={resolveDefaultAccountId(preset.accountId, data.accounts)}
            defaultType={preset.type}
            defaultCurrency={defaultCurrency}
            onSuccess={closeModal}
          />
        )}
      </Modal>

      {/* Shared POS sale form — same in-place pattern as the movement modal.
          SaleForm reuses the list page's form component (no logic duplicated)
          and closes itself via onDone after a successful create.
          C12-1: onRequestClose gates ESC/X/backdrop through the dirty-check. */}
      <Modal
        open={posModalOpen}
        onClose={closePosModal}
        onRequestClose={handlePosRequestClose}
        title={tSales("createSale")}
        size="lg"
      >
        {posLoadState === "error" ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{tToast("operationFailed")}</p>
            <button
              type="button"
              onClick={() => setPosLoadState("idle")}
              className="cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {tErrors("retry")}
            </button>
          </div>
        ) : posData === null ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {tCommon("loading")}
          </p>
        ) : posData.accounts.length === 0 ? (
          // Same account-needed guidance as the movement modal (H-10 style).
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{tMovements("noAccounts")}</p>
        ) : (
          <SaleForm
            catalogItems={posData.catalogItems}
            accounts={posData.accounts}
            clients={posData.clients}
            onDone={closePosModal}
            onCancel={handlePosRequestClose}
            dirtyRef={saleDirtyRef}
          />
        )}
      </Modal>

      {/* C12-1: close confirmation — rendered as a sibling of the POS Modal
          (not nested) so the focus traps don't overlap. The outer Modal stays
          mounted behind it; the confirmation's own focus trap takes over. */}
      <ConfirmDialog
        open={showPosCloseConfirm}
        onClose={handlePosCancelClose}
        onConfirm={handlePosConfirmClose}
        title={tSales("closeSaleTitle")}
        description={tSales("closeSaleDescription")}
        confirmLabel={tSales("leaveWithoutSaving")}
        cancelLabel={tSales("continueEditing")}
        tone="danger"
      />
    </GlobalMovementContext.Provider>
  );
}
