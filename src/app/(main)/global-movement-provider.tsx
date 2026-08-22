'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useT } from '../../i18n/client';
import type { MovementType } from '../../core/domain/movement';
import type { SerializedAccount } from '../../core/domain/account';
import type { SerializedCategory } from '../../core/domain/category';
import { listAccountsAction, listCategoriesAction } from './movements/actions';
import { MovementForm } from './movements/movement-form';
import { resolveDefaultAccountId } from '../../lib/movement-form';
import { Modal } from '../../components/ui/modal';
import { Icon } from '../../components/ui/icon';
import { Plus, TrendingUp, TrendingDown, X } from 'lucide-react';

export interface QuickMovementOptions {
  /** Preset movement type so the user starts directly on income or expense. */
  type?: MovementType;
  /** Account preselection (e.g. the active account filter on /movements). */
  accountId?: string;
}

interface GlobalMovementContextValue {
  openQuickMovement: (options?: QuickMovementOptions) => void;
}

const GlobalMovementContext =
  createContext<GlobalMovementContextValue | null>(null);

export function useQuickMovement(): GlobalMovementContextValue {
  const ctx = useContext(GlobalMovementContext);
  if (!ctx) {
    throw new Error(
      'useQuickMovement must be used within a GlobalMovementProvider',
    );
  }
  return ctx;
}

type LoadState = 'idle' | 'loading' | 'error';

interface FormDataPayload {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
}

export function GlobalMovementProvider({ children }: { children: ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [preset, setPreset] = useState<QuickMovementOptions>({});
  const [dialOpen, setDialOpen] = useState(false);
  const [data, setData] = useState<FormDataPayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const fabRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  const tMovements = useT('Movements');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const tErrors = useT('Errors');

  const openQuickMovement = useCallback(
    (options: QuickMovementOptions = {}) => {
      setPreset(options);
      setDialOpen(false);
      setModalOpen(true);
    },
    [],
  );

  const closeModal = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    if (!modalOpen || data !== null || loadState === 'error') return;
    let active = true;
    void (async () => {
      try {
        const [accounts, categories] = await Promise.all([
          listAccountsAction(),
          listCategoriesAction(),
        ]);
        if (active) setData({ accounts, categories });
      } catch {
        if (active) setLoadState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [modalOpen, data, loadState]);

  useEffect(() => {
    if (!dialOpen) return;
    const fab = fabRef.current;
    firstOptionRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDialOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      fab?.focus();
    };
  }, [dialOpen]);

  const value = { openQuickMovement };

  return (
    <GlobalMovementContext.Provider value={value}>
      {children}

      {/* Floating quick action — speed dial for direct income/expense entry */}
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 flex flex-col items-end gap-3 lg:bottom-8 lg:right-8">
        {dialOpen && (
          <>
            <div
              className="fixed inset-0"
              aria-hidden="true"
              onClick={() => setDialOpen(false)}
            />
            <div
              id="quick-movement-menu"
              role="group"
              aria-label={tMovements('quickAddMenu')}
              className="flex flex-col items-end gap-2"
            >
              <button
                ref={firstOptionRef}
                type="button"
                onClick={() => openQuickMovement({ type: 'income' })}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 shadow-md hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                <Icon
                  icon={TrendingUp}
                  size="sm"
                  className="text-green-600 dark:text-green-400"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {tMovements('income')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openQuickMovement({ type: 'expense' })}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 shadow-md hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                <Icon
                  icon={TrendingDown}
                  size="sm"
                  className="text-red-600 dark:text-red-400"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {tMovements('expense')}
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
          aria-controls={dialOpen ? 'quick-movement-menu' : undefined}
          aria-label={tMovements('quickAdd')}
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
        >
          <Icon icon={dialOpen ? X : Plus} size="lg" />
        </button>
      </div>

      {/* Shared movement form — single instance pattern for the whole app */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={tMovements('newMovement')}
        size="lg"
      >
        {loadState === 'error' ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {tToast('operationFailed')}
            </p>
            <button
              type="button"
              onClick={() => setLoadState('idle')}
              className="cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {tErrors('retry')}
            </button>
          </div>
        ) : data === null ? (
          <p
            className="text-sm text-zinc-500 dark:text-zinc-400"
            aria-live="polite"
          >
            {tCommon('loading')}
          </p>
        ) : data.accounts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {tMovements('noAccounts')}
          </p>
        ) : (
          <MovementForm
            accounts={data.accounts}
            categories={data.categories}
            defaultAccountId={resolveDefaultAccountId(
              preset.accountId,
              data.accounts,
            )}
            defaultType={preset.type}
            onSuccess={closeModal}
          />
        )}
      </Modal>
    </GlobalMovementContext.Provider>
  );
}
