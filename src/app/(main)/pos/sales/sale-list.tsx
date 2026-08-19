'use client';

import { useState } from 'react';
import { useT, useLocale } from '../../../../i18n/client';
import type { Sale } from '../../../../core/domain/sale';
import type { CatalogItem } from '../../../../core/domain/catalog';
import type { Account } from '../../../../core/domain/account';
import type { Client } from '../../../../core/domain/client';
import { SaleForm } from './sale-form';
import { AbonoForm } from './abono-form';
import { DeleteSaleButton } from './delete-sale-button';
import { DeleteSaleAbonoButton } from './delete-sale-abono-button';
import { formatAmount, formatDate } from '../../../../lib/format';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Icon } from '../../../../components/ui/icon';
import { Modal } from '../../../../components/ui/modal';
import { ShoppingCart } from 'lucide-react';

interface SaleListProps {
  sales: Sale[];
  catalogItems: CatalogItem[];
  accounts: Account[];
  clients: Client[];
}

export function SaleList({ sales, catalogItems, accounts, clients }: SaleListProps) {
  const [showForm, setShowForm] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
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
            const isExpanded = expandedSaleId === sale.id;

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
                          {t('pending')} {formatAmount(sale.pending, currency, locale)} {currency}
                        </span>
                      )}
                      <span className="ml-2">
                        {sale.items.length} {sale.items.length !== 1 ? t('itemCount_plural') : t('itemCount')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {isExpanded ? t('hide') : t('details')}
                    </button>
                    {sale.paymentMode === 'on-credit' && sale.pending > 0 && (
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

                {isExpanded && (
                  <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                    <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t('lineItems')}
                    </h3>
                    <div className="mb-3 space-y-1">
                      {sale.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                          <span>{t('item')} {idx + 1} ({t('qty')}: {item.quantity})</span>
                          <span>{formatAmount(item.subtotal, currency, locale)} {currency}</span>
                        </div>
                      ))}
                    </div>

                    {sale.abonos.length > 0 && (
                      <>
                        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {t('abonos')}
                        </h3>
                        <div className="space-y-1">
                          {sale.abonos.map((abono) => (
                            <div key={abono.id} className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                              <span>
                                {formatDate(abono.date, locale)} — {formatAmount(abono.amount.amount, currency, locale)} {currency}
                              </span>
                              <DeleteSaleAbonoButton saleId={sale.id} abonoId={abono.id} />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
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
