'use client';

import { useState } from 'react';
import { useT, useLocale } from '../../../../i18n/client';
import type { SerializedAccount } from '../../../../core/domain/account';
import type { SerializedCreditGranted } from '../../../../core/domain/credit-granted';
import { CreditForm } from './credit-form';
import { AbonoForm } from './abono-form';
import { EditAbonoForm } from './edit-abono-form';
import { EditCreditForm } from './edit-credit-form';
import { DeleteCreditButton } from './delete-credit-button';
import { DeleteAbonoButton } from './delete-abono-button';
import { formatAmount, formatDate } from '../../../../lib/format';
import { Icon } from '../../../../components/ui/icon';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Modal } from '../../../../components/ui/modal';
import { ActionIconButton } from '../../../../components/ui/action-icon-button';
import { ChevronDown, CreditCard, Pencil } from 'lucide-react';

export function CreditsGrantedList({
  accounts,
  credits,
}: {
  accounts: SerializedAccount[];
  credits: SerializedCreditGranted[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAbonoFormId, setShowAbonoFormId] = useState<string | null>(null);
  const [editingAbonoId, setEditingAbonoId] = useState<string | null>(null);
  const [editingCredit, setEditingCredit] = useState<SerializedCreditGranted | null>(null);
  const t = useT('CreditsGranted');
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
          {t('addCredit')}
        </button>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('newCredit')}
      >
        <CreditForm accounts={accounts} onSuccess={() => setShowForm(false)} />
      </Modal>

      <Modal
        open={!!editingCredit}
        onClose={() => setEditingCredit(null)}
        title={t('editCredit')}
      >
        {editingCredit && (
          <EditCreditForm
            creditId={editingCredit.id}
            principal={editingCredit.principal.amount}
            currency={editingCredit.principal.currency}
            onCancel={() => setEditingCredit(null)}
          />
        )}
      </Modal>

      {credits.length === 0 ? (
        <EmptyState
          icon={<Icon icon={CreditCard} size="xl" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="space-y-3">
          {credits.map((credit) => {
            const isExpanded = expandedId === credit.id;
            const pending = credit.pending;
            const currency = credit.principal.currency;

            return (
              <div
                key={credit.id}
                className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => setExpandedId(isExpanded ? null : credit.id)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-zinc-900 dark:text-white">
                      {credit.counterparty}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {formatDate(credit.date, locale)}
                      {credit.installments && ` · ${credit.installments} ${t('installmentCount')}`}
                      {credit.frequency && ` · ${t(credit.frequency)}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {formatAmount(credit.principal.amount, currency, locale)} {currency}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {pending > 0
                        ? `${t('pending')} ${formatAmount(pending, currency, locale)}`
                        : t('paidInFull')}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <span className="text-xs text-zinc-400">
                      {credit.abonos?.length} {credit.abonos?.length !== 1 ? t('abonoCount_plural') : t('abonoCount')}
                    </span>
                    <ActionIconButton
                      icon={Pencil}
                      label={tCommon('edit')}
                      tone="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCredit(credit);
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
                    {credit.abonos?.length > 0 && (
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
                            {credit.abonos?.map((abono) => (
                              <tr key={abono.id} className="text-zinc-600 dark:text-zinc-400">
                                <td className="py-1">{formatDate(abono.date, locale)}</td>
                                <td className="py-1 text-right">
                                  +{formatAmount(abono.amount.amount, currency, locale)} {currency}
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
                                    <DeleteAbonoButton creditId={credit.id} abonoId={abono.id} />
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
                            setShowAbonoFormId(showAbonoFormId === credit.id ? null : credit.id);
                            setEditingAbonoId(null);
                          }}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          {showAbonoFormId === credit.id ? tCommon('cancel') : t('addAbono')}
                        </button>
                      )}
                      <DeleteCreditButton creditId={credit.id} />
                    </div>

                    {showAbonoFormId === credit.id && (
                      <div className="mt-3">
                        <AbonoForm
                          creditId={credit.id}
                          pending={pending}
                          currency={currency}
                          accounts={accounts}
                        />
                      </div>
                    )}

                    {editingAbonoId && (
                      <div className="mt-3">
                        {credit.abonos
                          .filter((a) => a.id === editingAbonoId)
                          .map((abono) => (
                            <EditAbonoForm
                              key={abono.id}
                              creditId={credit.id}
                              abonoId={abono.id}
                              amount={abono.amount.amount}
                              date={abono.date.toISOString().split('T')[0]}
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
