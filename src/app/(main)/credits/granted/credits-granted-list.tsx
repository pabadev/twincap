"use client";

import { useState } from "react";
import { useT, useLocale } from "../../../../i18n/client";
import type { SerializedAccount } from "../../../../core/domain/account";
import type { SerializedCreditGranted } from "../../../../core/domain/credit-granted";
import { CreditForm } from "./credit-form";
import { AbonoForm } from "./abono-form";
import { EditAbonoForm } from "./edit-abono-form";
import { EditCreditForm } from "./edit-credit-form";
import { DeleteCreditButton } from "./delete-credit-button";
import { DeleteAbonoButton } from "./delete-abono-button";
import { MarkAsPaidButton } from "./mark-as-paid-button";
import { WriteOffButton } from "./write-off-button";
import { formatAmount, formatDate } from "../../../../lib/format";
import { businessDateToInputValue } from "../../../../lib/date";
import { Icon } from "../../../../components/ui/icon";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Modal } from "../../../../components/ui/modal";
import { ActionIconButton } from "../../../../components/ui/action-icon-button";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Select } from "../../../../components/ui/select";
import { Table } from "../../../../components/ui/table";
import { ChevronDown, CreditCard, Pencil, SlidersHorizontal } from "lucide-react";

export function CreditsGrantedList({
  accounts,
  credits,
  defaultCurrency,
}: {
  accounts: SerializedAccount[];
  credits: SerializedCreditGranted[];
  /** User's preferred currency for new operations. */
  defaultCurrency?: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAbonoFormId, setShowAbonoFormId] = useState<string | null>(null);
  const [editingAbonoId, setEditingAbonoId] = useState<string | null>(null);
  const [editingCredit, setEditingCredit] = useState<SerializedCreditGranted | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "writtenOff">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const t = useT("CreditsGranted");
  const tCommon = useT("Common");
  const locale = useLocale();

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (search ? 1 : 0);

  const filtered = credits.filter((credit) => {
    if (dateFrom && new Date(credit.date).getTime() < new Date(dateFrom).getTime()) return false;
    if (dateTo && new Date(credit.date).getTime() > new Date(dateTo + "T23:59:59.999Z").getTime())
      return false;
    if (statusFilter === "pending" && (credit.pending <= 0 || credit.writtenOff)) return false;
    if (statusFilter === "paid" && (credit.pending > 0 || credit.writtenOff)) return false;
    if (statusFilter === "writtenOff" && !credit.writtenOff) return false;
    if (search && !credit.counterparty.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          {t("addCredit")}
        </Button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t("newCredit")}>
        <CreditForm
          accounts={accounts}
          defaultCurrency={defaultCurrency}
          onSuccess={() => setShowForm(false)}
        />
      </Modal>

      <Modal open={!!editingCredit} onClose={() => setEditingCredit(null)} title={t("editCredit")}>
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
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          {/* Mobile: toggle button */}
          <div className="mb-4 sm:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="credits-granted-filters"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("filters")}
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile: collapsible filter bar */}
          {filtersOpen && (
            <div id="credits-granted-filters" className="mb-6 sm:hidden">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label
                    htmlFor="credits-granted-filter-date-from-mobile"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    {t("filterDateFrom")}
                  </label>
                  <input
                    id="credits-granted-filter-date-from-mobile"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="credits-granted-filter-date-to-mobile"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    {t("filterDateTo")}
                  </label>
                  <input
                    id="credits-granted-filter-date-to-mobile"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="credits-granted-filter-status-mobile"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    {t("filterStatus")}
                  </label>
                  <Select
                    id="credits-granted-filter-status-mobile"
                    options={[
                      { value: "all", label: t("filterAllStatus") },
                      { value: "pending", label: t("filterPending") },
                      { value: "paid", label: t("filterPaid") },
                      { value: "writtenOff", label: t("filterWrittenOff") },
                    ]}
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as "all" | "pending" | "paid" | "writtenOff")
                    }
                    className="w-40"
                  />
                </div>
                <div>
                  <label
                    htmlFor="credits-granted-filter-search-mobile"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    {t("filterSearch")}
                  </label>
                  <input
                    id="credits-granted-filter-search-mobile"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("filterSearch")}
                    className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Desktop: always visible filter bar */}
          <div className="mb-4 hidden flex-wrap items-center gap-3 sm:flex">
            <div>
              <label
                htmlFor="credits-granted-filter-date-from"
                className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                {t("filterDateFrom")}
              </label>
              <input
                id="credits-granted-filter-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="credits-granted-filter-date-to"
                className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                {t("filterDateTo")}
              </label>
              <input
                id="credits-granted-filter-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="credits-granted-filter-status"
                className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                {t("filterStatus")}
              </label>
              <Select
                id="credits-granted-filter-status"
                options={[
                  { value: "all", label: t("filterAllStatus") },
                  { value: "pending", label: t("filterPending") },
                  { value: "paid", label: t("filterPaid") },
                  { value: "writtenOff", label: t("filterWrittenOff") },
                ]}
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | "pending" | "paid" | "writtenOff")
                }
                className="w-40"
              />
            </div>
            <div>
              <label
                htmlFor="credits-granted-filter-search"
                className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                {t("filterSearch")}
              </label>
              <input
                id="credits-granted-filter-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("filterSearch")}
                className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
              />
            </div>
          </div>

          {filtered.length === 0 && credits.length > 0 && <EmptyState title={t("noResults")} />}

          {/* Product decision 2026-09-21: cards everywhere; on PC the cards
              may arrange in a 2-column grid. Beta round 3: equal card heights
              per row (grid default stretch) so lighter cards don't break the
              grid's symmetry. */}
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((credit) => {
              const isExpanded = expandedId === credit.id;
              const pending = credit.pending;
              const currency = credit.principal.currency;
              const isPaid = pending <= 0;
              const isDimmed = isPaid || !!credit.writtenOff;
              const showSplitColumns =
                credit.abonos?.some((a) => a.capitalAmount || a.interestAmount) ?? false;
              const paidInstallments =
                credit.installments && credit.installmentValue
                  ? Math.min(
                      Math.floor(
                        (credit.abonos?.reduce((sum, a) => sum + a.amount.amount, 0) ?? 0) /
                          credit.installmentValue.amount,
                      ),
                      credit.installments,
                    )
                  : undefined;

              return (
                <div
                  key={credit.id}
                  className={`flex h-full flex-col overflow-hidden rounded-lg border border-surface-border bg-surface-card dark:border-zinc-700 dark:bg-zinc-900 ${isDimmed ? "opacity-60" : ""}`}
                >
                  {/* Beta feedback: the collapsed card follows the Movements
                      card format — row 1 identity + chevron, then label/value
                      rows, then a bordered footer with count + actions. */}
                  <div
                    className="flex-1 cursor-pointer px-4 py-3 hover:bg-surface-bg dark:hover:bg-zinc-800"
                    onClick={() => setExpandedId(isExpanded ? null : credit.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 font-medium text-zinc-900 dark:text-white">
                        <span className="min-w-0 truncate">{credit.counterparty}</span>
                        {isPaid && <Badge variant="success">{tCommon("paid")}</Badge>}
                        {credit.writtenOff && <Badge variant="danger">{t("writtenOff")}</Badge>}
                      </div>
                      <Icon
                        icon={ChevronDown}
                        size="sm"
                        className={`shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>

                    <dl className="mt-2 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {tCommon("date")}
                        </dt>
                        <dd className="text-right text-xs text-zinc-600 dark:text-zinc-400">
                          {formatDate(credit.date, locale)}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {tCommon("amount")}
                        </dt>
                        <dd className="text-right text-sm font-medium tabular-nums text-zinc-900 dark:text-white">
                          {formatAmount(credit.principal.amount, currency, locale)}
                        </dd>
                      </div>
                      {credit.installments && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {t("installmentsRow")}
                          </dt>
                          <dd className="text-right text-xs text-zinc-600 dark:text-zinc-400">
                            {paidInstallments !== undefined
                              ? `${paidInstallments}/${credit.installments}`
                              : credit.installments}{" "}
                            {t("installmentCount")}
                            {credit.frequency && ` · ${t(credit.frequency)}`}
                          </dd>
                        </div>
                      )}
                      {credit.installments && credit.installmentValue && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {t("totalToPayLabel")}
                          </dt>
                          <dd className="text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                            {formatAmount(credit.totalToPay, currency, locale)}
                          </dd>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {t("pending")}
                        </dt>
                        <dd
                          className={`text-right text-sm font-medium tabular-nums ${
                            pending > 0 ? "text-debt" : "text-success"
                          }`}
                        >
                          {pending > 0 ? formatAmount(pending, currency, locale) : t("paidInFull")}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-zinc-100 px-4 py-2 dark:border-zinc-800">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      {credit.abonos?.length}{" "}
                      {credit.abonos?.length !== 1 ? t("abonoCount_plural") : t("abonoCount")}
                    </span>
                    {!credit.writtenOff && (
                      <ActionIconButton
                        icon={Pencil}
                        label={tCommon("edit")}
                        tone="primary"
                        onClick={() => setEditingCredit(credit)}
                      />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                      {credit.abonos?.length > 0 && (
                        <div className="mb-3">
                          <h4 className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {t("abonos")}
                          </h4>
                          {/* Desktop (>=640px): compact expandable table keeps
                            its bespoke cells (pb-1 / py-1, text-xs header row)
                            — only the `<table>` element fits the ui/table
                            contract here. */}
                          <div className="max-sm:hidden">
                            <Table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                  <th className="pb-1 text-left">{tCommon("date")}</th>
                                  <th className="pb-1 text-right">{tCommon("amount")}</th>
                                  {showSplitColumns && (
                                    <>
                                      <th className="pb-1 text-right">{t("capital")}</th>
                                      <th className="pb-1 text-right">{t("interest")}</th>
                                    </>
                                  )}
                                  <th className="pb-1 text-right">{tCommon("actions")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {credit.abonos?.map((abono) => (
                                  <tr key={abono.id} className="text-zinc-600 dark:text-zinc-400">
                                    <td className="py-1">{formatDate(abono.date, locale)}</td>
                                    <td className="py-1 text-right">
                                      +{formatAmount(abono.amount.amount, currency, locale)}
                                    </td>
                                    {showSplitColumns && (
                                      <>
                                        <td className="py-1 text-right">
                                          {abono.capitalAmount
                                            ? `+${formatAmount(abono.capitalAmount.amount, currency, locale)}`
                                            : "—"}
                                        </td>
                                        <td className="py-1 text-right">
                                          {abono.interestAmount
                                            ? `+${formatAmount(abono.interestAmount.amount, currency, locale)}`
                                            : "—"}
                                        </td>
                                      </>
                                    )}
                                    <td className="py-1 text-right">
                                      {!credit.writtenOff && (
                                        <div className="flex items-center justify-end gap-1">
                                          <ActionIconButton
                                            icon={Pencil}
                                            label={tCommon("edit")}
                                            tone="primary"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingAbonoId(
                                                editingAbonoId === abono.id ? null : abono.id,
                                              );
                                              setShowAbonoFormId(null);
                                            }}
                                          />
                                          <DeleteAbonoButton
                                            creditId={credit.id}
                                            abonoId={abono.id}
                                          />
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>

                          {/* Mobile (<640px): the same abonos as stacked rows —
                              a 5-column table (date/amount/capital/interest/
                              actions) is illegible at card width (§20). */}
                          <div className="space-y-2 sm:hidden">
                            {credit.abonos?.map((abono) => (
                              <div
                                key={abono.id}
                                className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                              >
                                <div className="flex items-baseline justify-between gap-3">
                                  <span className="text-zinc-600 dark:text-zinc-400">
                                    {formatDate(abono.date, locale)}
                                  </span>
                                  <span className="font-medium tabular-nums text-zinc-900 dark:text-white">
                                    +{formatAmount(abono.amount.amount, currency, locale)}
                                  </span>
                                </div>
                                {showSplitColumns && (
                                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-zinc-600 dark:text-zinc-400">
                                    <span>
                                      {t("capital")}:{" "}
                                      {abono.capitalAmount
                                        ? `+${formatAmount(abono.capitalAmount.amount, currency, locale)}`
                                        : "—"}
                                    </span>
                                    <span>
                                      {t("interest")}:{" "}
                                      {abono.interestAmount
                                        ? `+${formatAmount(abono.interestAmount.amount, currency, locale)}`
                                        : "—"}
                                    </span>
                                  </div>
                                )}
                                {!credit.writtenOff && (
                                  <div className="mt-2 flex items-center justify-end gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                                    <ActionIconButton
                                      icon={Pencil}
                                      label={tCommon("edit")}
                                      tone="primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingAbonoId(
                                          editingAbonoId === abono.id ? null : abono.id,
                                        );
                                        setShowAbonoFormId(null);
                                      }}
                                    />
                                    <DeleteAbonoButton creditId={credit.id} abonoId={abono.id} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        {!credit.writtenOff && pending > 0 && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAbonoFormId(showAbonoFormId === credit.id ? null : credit.id);
                              setEditingAbonoId(null);
                            }}
                          >
                            {showAbonoFormId === credit.id ? tCommon("cancel") : t("addAbono")}
                          </Button>
                        )}
                        {!credit.writtenOff && pending > 0 && (
                          <MarkAsPaidButton
                            creditId={credit.id}
                            pending={pending}
                            currency={currency}
                            accounts={accounts}
                          />
                        )}
                        {!credit.saleId && !credit.writtenOff && pending > 0 && (
                          <WriteOffButton creditId={credit.id} counterparty={credit.counterparty} />
                        )}
                        {!credit.writtenOff && <DeleteCreditButton creditId={credit.id} />}
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
        </>
      )}
    </div>
  );
}
