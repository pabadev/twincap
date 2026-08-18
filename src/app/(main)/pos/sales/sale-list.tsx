'use client';

import { useState } from 'react';
import type { Sale } from '../../../../core/domain/sale';
import type { CatalogItem } from '../../../../core/domain/catalog';
import type { Account } from '../../../../core/domain/account';
import { SaleForm } from './sale-form';
import { AbonoForm } from './abono-form';
import { deleteSaleAction, deleteSaleAbonoAction } from './actions';

function formatAmount(amount: number, currency: string): string {
  const exp = currency === 'COP' ? 0 : 2;
  const divisor = 10 ** exp;
  const value = amount / divisor;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  });
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString();
}

interface SaleListProps {
  sales: Sale[];
  catalogItems: CatalogItem[];
  accounts: Account[];
}

export function SaleList({ sales, catalogItems, accounts }: SaleListProps) {
  const [showForm, setShowForm] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [abonoSaleId, setAbonoSaleId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Sales
        </h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setAbonoSaleId(null);
          }}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {showForm ? 'Cancel' : 'New Sale'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            Create Sale
          </h2>
          <SaleForm
            catalogItems={catalogItems}
            accounts={accounts}
            onDone={() => setShowForm(false)}
          />
        </div>
      )}

      {abonoSaleId && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            Add Payment (Abono)
          </h2>
          <AbonoForm
            saleId={abonoSaleId}
            accounts={accounts}
            onDone={() => setAbonoSaleId(null)}
          />
        </div>
      )}

      {sales.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No sales yet.
        </p>
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
                    <div className="font-medium text-zinc-900 dark:text-white">
                      {formatDate(sale.date)} — {formatAmount(sale.total, currency)} {currency}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {sale.paymentMode}
                      </span>
                      {sale.paymentMode === 'on-credit' && (
                        <span className="ml-2">
                          Pending: {formatAmount(sale.pending, currency)} {currency}
                        </span>
                      )}
                      <span className="ml-2">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                    </button>
                    {sale.paymentMode === 'on-credit' && sale.pending > 0 && (
                      <button
                        onClick={() => setAbonoSaleId(abonoSaleId === sale.id ? null : sale.id)}
                        className="text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                      >
                        Add Abono
                      </button>
                    )}
                    <form
                      action={deleteSaleAction}
                      onSubmit={(e) => {
                        if (!confirm('Delete this sale? This will restore stock and reverse all payments.')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="saleId" value={sale.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                    <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Line Items
                    </h3>
                    <div className="mb-3 space-y-1">
                      {sale.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                          <span>Item {idx + 1} (Qty: {item.quantity})</span>
                          <span>{formatAmount(item.subtotal, currency)} {currency}</span>
                        </div>
                      ))}
                    </div>

                    {sale.abonos.length > 0 && (
                      <>
                        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Abonos
                        </h3>
                        <div className="space-y-1">
                          {sale.abonos.map((abono) => (
                            <div key={abono.id} className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                              <span>
                                {formatDate(abono.date)} — {formatAmount(abono.amount.amount, currency)} {currency}
                              </span>
                              <form
                                action={deleteSaleAbonoAction}
                                onSubmit={(e) => {
                                  if (!confirm('Delete this abono?')) {
                                    e.preventDefault();
                                  }
                                }}
                                className="inline"
                              >
                                <input type="hidden" name="saleId" value={sale.id} />
                                <input type="hidden" name="abonoId" value={abono.id} />
                                <button
                                  type="submit"
                                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Remove
                                </button>
                              </form>
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
