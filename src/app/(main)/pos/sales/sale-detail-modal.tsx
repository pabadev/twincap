'use client';

import { useEffect, useState } from 'react';
import { useT, useLocale } from '../../../../i18n/client';
import { getSaleDetailAction } from './actions';
import type { SaleDetailSnapshot } from '../../../../core/application/sales';
import { DeleteSaleAbonoButton } from './delete-sale-abono-button';
import { formatAmount, formatDate } from '../../../../lib/format';
import { Modal } from '../../../../components/ui/modal';

interface SaleDetailModalProps {
  saleId: string | null;
  onClose: () => void;
}

interface DetailState {
  id: string;
  snapshot?: SaleDetailSnapshot;
  errorKey?: string;
}

export function SaleDetailModal({ saleId, onClose }: SaleDetailModalProps) {
  const t = useT('Sales');
  const tCommon = useT('Common');
  const tError = useT('error');
  const locale = useLocale();
  const [detail, setDetail] = useState<DetailState | null>(null);

  // Loading is derived, not stored: while the fetched record does not match
  // the requested one we are mid-flight. setState only ever runs in async
  // continuations, never synchronously inside an effect.
  const loading = !!saleId && detail?.id !== saleId;
  const snapshot = detail?.id === saleId ? detail.snapshot ?? null : null;
  const errorKey = detail?.id === saleId ? detail.errorKey ?? null : null;

  useEffect(() => {
    if (!saleId) return;
    let cancelled = false;
    getSaleDetailAction(saleId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setDetail({ id: saleId, snapshot: result.sale });
        } else {
          setDetail({ id: saleId, errorKey: result.error });
        }
      })
      .catch(() => {
        if (!cancelled) setDetail({ id: saleId, errorKey: 'error.operationFailed' });
      });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const handleClose = () => {
    setDetail(null);
    onClose();
  };

  return (
    <Modal
      open={!!saleId}
      onClose={handleClose}
      title={t('saleDetail')}
      size="lg"
    >
      {loading && (
        <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {tCommon('loading')}
        </p>
      )}

      {!loading && errorKey && (
        <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {tError(errorKey.replace('error.', ''))}
        </p>
      )}

      {!loading && snapshot && (
        <div className="space-y-5">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t('saleIdLabel')}</dt>
              <dd className="break-all font-mono text-xs text-zinc-900 dark:text-white">{snapshot.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{tCommon('date')}</dt>
              <dd className="text-zinc-900 dark:text-white">{formatDate(snapshot.date, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t('client')}</dt>
              <dd className="text-zinc-900 dark:text-white">{snapshot.clientName ?? t('generalClient')}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t('paymentMode')}</dt>
              <dd>
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {snapshot.paymentMode === 'paid-in-full' ? t('paidInFull') : t('onCredit')}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t('status')}</dt>
              <dd>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    snapshot.status === 'paid'
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {snapshot.status === 'paid' ? t('statusPaid') : t('statusPending')}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{tCommon('account')}</dt>
              <dd className="text-zinc-900 dark:text-white">{snapshot.accountName ?? '—'}</dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('lineItems')}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 dark:text-zinc-400">
                    <th className="pb-1 text-left">{t('item')}</th>
                    <th className="pb-1 text-right">{t('qty')}</th>
                    <th className="pb-1 text-right">{t('unitPrice')}</th>
                    <th className="pb-1 text-right">{t('subtotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {snapshot.items.map((item, idx) => (
                    <tr key={idx} className="text-zinc-600 dark:text-zinc-400">
                      <td className="py-1.5">{item.itemName ?? t('itemDeleted')}</td>
                      <td className="py-1.5 text-right">{item.quantity}</td>
                      <td className="py-1.5 text-right">
                        {formatAmount(item.unitPrice.amount, item.unitPrice.currency, locale)}
                      </td>
                      <td className="py-1.5 text-right">
                        {formatAmount(item.subtotal, snapshot.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <dl className="space-y-1 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-700">
            <div className="flex justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">{t('total')}</dt>
              <dd className="font-medium text-zinc-900 dark:text-white">
                {formatAmount(snapshot.total, snapshot.currency, locale)}
              </dd>
            </div>
            {snapshot.paymentMode === 'on-credit' && (
              <>
                <div className="flex justify-between">
                  <dt className="text-zinc-500 dark:text-zinc-400">{t('initialPayment')}</dt>
                  <dd className="text-zinc-900 dark:text-white">
                    {formatAmount(snapshot.initialPayment, snapshot.currency, locale)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500 dark:text-zinc-400">{t('pending')}</dt>
                  <dd
                    className={`font-medium ${
                      snapshot.pending > 0
                        ? 'text-debt'
                        : 'text-success'
                    }`}
                  >
                    {formatAmount(snapshot.pending, snapshot.currency, locale)}
                  </dd>
                </div>
              </>
            )}
          </dl>

          {(snapshot.abonos.length > 0 || snapshot.hasLinkedCredit) && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('abonos')}
              </h3>
              {snapshot.hasLinkedCredit && (
                <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {t('managedInCredits')}
                </p>
              )}
              {snapshot.abonos.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs text-zinc-500 dark:text-zinc-400">
                        <th className="pb-1 text-left">{tCommon('date')}</th>
                        <th className="pb-1 text-right">{tCommon('amount')}</th>
                        {!snapshot.hasLinkedCredit && (
                          <th className="pb-1 text-right">{tCommon('actions')}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                      {snapshot.abonos.map((abono) => (
                        <tr key={abono.id} className="text-zinc-600 dark:text-zinc-400">
                          <td className="py-1.5">{formatDate(abono.date, locale)}</td>
                          <td className="py-1.5 text-right">
                            +{formatAmount(abono.amount.amount, abono.amount.currency, locale)}
                          </td>
                          {!snapshot.hasLinkedCredit && (
                            <td className="py-1.5 text-right">
                              <DeleteSaleAbonoButton
                                saleId={snapshot.id}
                                abonoId={abono.id}
                                onDeleted={handleClose}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('noAbonos')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
