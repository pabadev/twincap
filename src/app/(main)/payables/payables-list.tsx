'use client';

import { useState } from 'react';
import { useT, useLocale } from '../../../i18n/client';
import type { SerializedAccount } from '../../../core/domain/account';
import type { SerializedPayable } from '../../../core/domain/payable';
import { PayableForm } from './payable-form';
import { AbonoForm } from './abono-form';
import { EditAbonoForm } from './edit-abono-form';
import { EditPayableForm } from './edit-payable-form';
import { DeletePayableButton } from './delete-payable-button';
import { DeleteAbonoButton } from './delete-abono-button';
import { formatAmount, formatDate } from '../../../lib/format';
import { businessDateToInputValue } from '../../../lib/date';
import { Icon } from '../../../components/ui/icon';
import { EmptyState } from '../../../components/ui/empty-state';
import { Modal } from '../../../components/ui/modal';
import { ActionIconButton } from '../../../components/ui/action-icon-button';
import { ChevronDown, ReceiptText, Pencil } from 'lucide-react';

export function PayablesList({
  accounts,
  payables,
}: {
  accounts: SerializedAccount[];
  payables: SerializedPayable[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAbonoFormId, setShowAbonoFormId] = useState<string | null>(null);
  const [editingAbonoId, setEditingAbonoId] = useState<string | null>(null);
  const [editingPayable, setEditingPayable] = useState<SerializedPayable | null>(null);
  const t = useT('Payables');
  const tCommon = useT('Common');
  const locale = useLocale();

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
          {t('addPayable')}
        </button>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('newPayable')}
      >
        <PayableForm accounts={accounts} onSuccess={() => setShowForm(false)} />
      </Modal>

      <Modal
        open={!!editingPayable}
        onClose={() => setEditingPayable(null)}
        title={t('editPayable')}
      >
        {editingPayable && (
          <EditPayableForm
            payableId={editingPayable.id}
            total={editingPayable.total.amount}
            currency={editingPayable.total.currency}
            onCancel={() => setEditingPayable(null)}
          />
        )}
      </Modal>

      {payables.length === 0 ? (
        <EmptyState
          icon={<Icon icon={ReceiptText} size="xl" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="space-y-3">
          {payables.map((payable) => {
            const isExpanded = expandedId === payable.id;
            const pending = payable.pending;
            const currency = payable.total.currency;

            return (
              <div
                key={payable.id}
                className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => setExpandedId(isExpanded ? null : payable.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-zinc-900 dark:text-white">
                      {payable.counterparty}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {formatDate(payable.date, locale)}
                      {payable.dueDate && ` · ${t('dueDateShort')} ${formatDate(payable.dueDate, locale)}`}
                      {payable.note && ` · ${payable.note}`}
                    </div>
                  </div>
                  <div className="ml-3 text-right">
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {formatAmount(payable.total.amount, currency, locale)}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {pending > 0
                        ? `${t('pending')} ${formatAmount(pending, currency, locale)}`
                        : t('paidInFull')}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <span className="hidden text-xs text-zinc-400 sm:inline">
                      {payable.abonos?.length} {payable.abonos?.length !== 1 ? t('abonoCount_plural') : t('abonoCount')}
                    </span>
                    <ActionIconButton
                      icon={Pencil}
                      label={tCommon('edit')}
                      tone="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPayable(payable);
                      }}
                    />
                    <Icon
                      icon={ChevronDown}
                      size="sm"
                      className={`text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                    {payable.initialPayment > 0 && (
                      <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {t('initialPaymentPaid')}:{' '}
                        {formatAmount(payable.initialPayment, currency, locale)}
                      </p>
                    )}

                    {payable.abonos?.length > 0 && (
                      <div className="mb-3">
                        <h4 className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {t('abonos')}
                        </h4>
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-xs text-zinc-500 dark:text-zinc-400">
                              <th className="pb-1 text-left">{tCommon('date')}</th>
                              <th className="pb-1 text-right">{tCommon('amount')}</th>
                              <th className="pb-1 text-right">{tCommon('actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payable.abonos?.map((abono) => (
                              <tr key={abono.id} className="text-zinc-600 dark:text-zinc-400">
                                <td className="py-1">{formatDate(abono.date, locale)}</td>
                                <td className="py-1 text-right">
                                  −{formatAmount(abono.amount.amount, currency, locale)}
                                </td>
                                <td className="py-1 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <ActionIconButton
                                      icon={Pencil}
                                      label={tCommon('edit')}
                                      tone="primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingAbonoId(editingAbonoId === abono.id ? null : abono.id);
                                        setShowAbonoFormId(null);
                                      }}
                                    />
                                    <DeleteAbonoButton payableId={payable.id} abonoId={abono.id} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      {pending > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAbonoFormId(showAbonoFormId === payable.id ? null : payable.id);
                            setEditingAbonoId(null);
                          }}
                          className="rounded-md bg-success px-3 py-1.5 text-xs font-medium text-white hover:bg-success/90"
                        >
                          {showAbonoFormId === payable.id ? tCommon('cancel') : t('addAbono')}
                        </button>
                      )}
                      <DeletePayableButton payableId={payable.id} />
                    </div>

                    {showAbonoFormId === payable.id && (
                      <div className="mt-3">
                        <AbonoForm
                          payableId={payable.id}
                          pending={pending}
                          currency={currency}
                          accounts={accounts}
                        />
                      </div>
                    )}

                    {editingAbonoId && (
                      <div className="mt-3">
                        {payable.abonos
                          .filter((a) => a.id === editingAbonoId)
                          .map((abono) => (
                            <EditAbonoForm
                              key={abono.id}
                              payableId={payable.id}
                              abonoId={abono.id}
                              amount={abono.amount.amount}
                              date={businessDateToInputValue(abono.date)}
                              onCancel={() => setEditingAbonoId(null)}
                            />
                          ))}
                      </div>
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
