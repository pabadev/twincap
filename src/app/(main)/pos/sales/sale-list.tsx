'use client';

import { useState } from 'react';
import { useT, useLocale } from '../../../../i18n/client';
import type { SerializedSale } from '../../../../core/domain/sale';
import type { SerializedCatalogItem } from '../../../../core/domain/catalog';
import type { SerializedAccount } from '../../../../core/domain/account';
import type { SerializedClient } from '../../../../core/domain/client';
import { SaleForm } from './sale-form';
import { AbonoForm } from './abono-form';
import { SaleDetailModal } from './sale-detail-modal';
import { DeleteSaleButton } from './delete-sale-button';
import { formatAmount, formatDate } from '../../../../lib/format';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Icon } from '../../../../components/ui/icon';
import { Modal } from '../../../../components/ui/modal';
import { ActionIconButton } from '../../../../components/ui/action-icon-button';
import { Eye, ShoppingCart } from 'lucide-react';

interface SaleListProps {
  sales: SerializedSale[];
  catalogItems: SerializedCatalogItem[];
  accounts: SerializedAccount[];
  clients: SerializedClient[];
  /** H14: pending per sale owned by its linked CreditGranted, when one exists. */
  creditPendingBySaleId?: Record<string, number>;
}

export function SaleList({ sales, catalogItems, accounts, clients, creditPendingBySaleId }: SaleListProps) {
  const [showForm, setShowForm] = useState(false);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [abonoSaleId, setAbonoSaleId] = useState<string | null>(null);
  const t = useT('Sales');
  const locale = useLocale();

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {t('newSale')}
        </button>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('createSale')}
      >
        <SaleForm
          catalogItems={catalogItems}
          accounts={accounts}
          clients={clients}
          onDone={() => setShowForm(false)}
        />
      </Modal>

      <Modal
        open={!!abonoSaleId}
        onClose={() => setAbonoSaleId(null)}
        title={t('addPayment')}
      >
        {abonoSaleId && (
          <AbonoForm
            saleId={abonoSaleId}
            accounts={accounts}
            onDone={() => setAbonoSaleId(null)}
          />
        )}
      </Modal>

      <SaleDetailModal saleId={detailSaleId} onClose={() => setDetailSaleId(null)} />

      {sales.length === 0 ? (
        <EmptyState
          icon={<Icon icon={ShoppingCart} size="xl" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const currency = sale.items[0]?.unitPrice.currency ?? 'COP';
            // H14: a linked credit owns the real pending of the sale.
            const hasLinkedCredit = Object.prototype.hasOwnProperty.call(creditPendingBySaleId ?? {}, sale.id);
            const effectivePending = hasLinkedCredit
              ? (creditPendingBySaleId as Record<string, number>)[sale.id]
              : sale.pending;

            return (
              <div
                key={sale.id}
                className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1">
                    <div className="text-sm text-zinc-900 dark:text-white">
                      {formatDate(sale.date, locale)} — {formatAmount(sale.total, currency, locale)} {currency}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {sale.paymentMode === 'paid-in-full' ? t('paidInFull') : t('onCredit')}
                      </span>
                      {sale.clientId && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                          {clientMap.get(sale.clientId) ?? t('generalClient')}
                        </span>
                      )}
                      {sale.paymentMode === 'on-credit' && (
                        <span className="ml-2">
                          {t('pending')} {formatAmount(effectivePending, currency, locale)} {currency}
                        </span>
                      )}
                      <span className="ml-2">
                        {sale.items.length} {sale.items.length !== 1 ? t('itemCount_plural') : t('itemCount')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ActionIconButton
                      icon={Eye}
                      label={t('details')}
                      tone="primary"
                      onClick={() => setDetailSaleId(sale.id)}
                    />
                    {sale.paymentMode === 'on-credit' && !hasLinkedCredit && effectivePending > 0 && (
                      <button
                        onClick={() => setAbonoSaleId(sale.id)}
                        className="text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                      >
                        {t('addAbono')}
                      </button>
                    )}
                    <DeleteSaleButton saleId={sale.id} />
                  </div>
                </div>

                {hasLinkedCredit && sale.paymentMode === 'on-credit' && effectivePending > 0 && (
                  <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('managedInCredits')}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
