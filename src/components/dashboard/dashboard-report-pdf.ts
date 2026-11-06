import { jsPDF } from "jspdf";
import type { DashboardSnapshot } from "../../core/application/dashboard/dashboard-types";
import { formatAmount, formatDate } from "../../lib/format";

export interface DashboardReportLabels {
  title: string;
  generated: string;
  scope: string;
  period: string;
  account: string;
  category: string;
  available: string;
  result: string;
  income: string;
  expenses: string;
  financing: string;
  received: string;
  granted: string;
  incomeCategories: string;
  expenseCategories: string;
  amount: string;
  position: string;
  assets: string;
  liabilities: string;
  net: string;
  recent: string;
  date: string;
  type: string;
  note: string;
  business: string;
  sales: string;
  salesCount: string;
  cost: string;
  expensesRecorded: string;
  businessResult: string;
  collected: string;
  receivable: string;
  incomplete: string;
  all: string;
  personal: string;
  businessScope: string;
  month: string;
  year: string;
  noFilter: string;
  noData: string;
  notAvailable: string;
}

export interface BusinessReportRow {
  currency: string;
  salesMinor: number;
  saleCount: number;
  knownCostMinor: number;
  expensesMinor: number;
  receivableMinor: number;
  registeredResultMinor: number | null;
  incompleteSales: number;
}

export function buildDashboardReportPdf(args: {
  snapshot: DashboardSnapshot;
  locale: string;
  labels: DashboardReportLabels;
  generatedAt?: Date;
  positionData?: Array<{ currency: string; activos: number; pasivos: number; net: number }>;
  businessRows?: BusinessReportRow[];
  accountLabel?: string;
  categoryLabel?: string;
}) {
  const { snapshot, labels, locale } = args;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const left = 14;
  const right = width - 14;
  let y = 16;
  const money = (value: number, currency: string) => formatAmount(value, currency, locale);
  const line = (value: string, bold = false, indent = 0) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    const lines = pdf.splitTextToSize(value, right - left - indent);
    if (y + lines.length * 5 + 2 > height - 14) {
      pdf.addPage();
      y = 16;
    }
    pdf.text(lines, left + indent, y);
    y += lines.length * 5 + 2;
  };
  const section = (title: string) => {
    y += 2;
    line(title, true);
    pdf.setDrawColor(190);
    pdf.line(left, y, right, y);
    y += 5;
  };
  const scopeLabel =
    snapshot.filters.scope === "Personal"
      ? labels.personal
      : snapshot.filters.scope === "Business"
        ? labels.businessScope
        : labels.all;

  pdf.setFontSize(17);
  line(labels.title, true);
  pdf.setFontSize(9);
  line(`${labels.generated}: ${formatDate(args.generatedAt ?? new Date(), locale)}`);
  line(`${labels.scope}: ${scopeLabel}`);
  const periodText =
    snapshot.filters.scope === "Business" && snapshot.filters.from && snapshot.filters.to
      ? `${snapshot.filters.from} – ${snapshot.filters.to}`
      : snapshot.filters.period === "year"
        ? labels.year
        : labels.month;
  line(`${labels.period}: ${periodText}`);
  if (snapshot.filters.accountId !== "all")
    line(`${labels.account}: ${args.accountLabel ?? snapshot.filters.accountId}`);
  if (snapshot.filters.categoryId !== "all")
    line(`${labels.category}: ${args.categoryLabel ?? snapshot.filters.categoryId}`);

  section(labels.available);
  for (const row of snapshot.currencyBreakdown) {
    line(
      `${row.currency} · ${labels.available}: ${money(row.balance, row.currency)} · ${labels.result}: ${money(row.result, row.currency)}`,
    );
  }
  if (snapshot.currencyBreakdown.length === 0) line(labels.noData);

  section(labels.income);
  for (const row of snapshot.currencyBreakdown) {
    line(
      `${row.currency} · ${labels.income}: ${money(row.income, row.currency)} · ${labels.expenses}: ${money(row.expenses, row.currency)}`,
    );
  }
  for (const row of snapshot.financingBreakdown) {
    line(
      `${row.currency} · ${labels.financing}: ${labels.received} ${money(row.inflow, row.currency)} · ${labels.granted} ${money(row.outflow, row.currency)}`,
    );
  }

  if (snapshot.filters.scope === "Business") {
    section(labels.business);
    for (const row of args.businessRows ?? []) {
      line(
        `${row.currency} · ${labels.sales}: ${money(row.salesMinor, row.currency)} (${row.saleCount}) · ${labels.cost}: ${money(row.knownCostMinor, row.currency)}`,
      );
      line(
        `${labels.expensesRecorded}: ${money(row.expensesMinor, row.currency)} · ${labels.collected}: ${money(row.salesMinor - row.receivableMinor, row.currency)} · ${labels.receivable}: ${money(row.receivableMinor, row.currency)}`,
        false,
        3,
      );
      line(
        `${labels.businessResult}: ${row.registeredResultMinor === null ? labels.notAvailable : money(row.registeredResultMinor, row.currency)}${row.incompleteSales > 0 ? ` · ${labels.incomplete}: ${row.incompleteSales}` : ""}`,
        false,
        3,
      );
    }
    if (!args.businessRows?.length) line(labels.noData);
    line(labels.note);
  }

  if (snapshot.filters.scope !== "Business") {
    section(labels.incomeCategories);
    for (const row of snapshot.incomeRows) line(`${row.label} · ${money(row.value, row.currency)}`);
    if (!snapshot.incomeRows.length) line(labels.noData);
    section(labels.expenseCategories);
    for (const row of snapshot.expenseRows)
      line(`${row.label} · ${money(row.value, row.currency)}`);
    if (!snapshot.expenseRows.length) line(labels.noData);
  }

  if (snapshot.filters.scope === "all") {
    section(labels.position);
    for (const row of args.positionData ?? []) {
      line(
        `${row.currency} · ${labels.assets}: ${money(row.activos, row.currency)} · ${labels.liabilities}: ${money(row.pasivos, row.currency)} · ${labels.net}: ${money(row.net, row.currency)}`,
      );
    }
    if (!args.positionData?.length) line(labels.noData);
  }

  section(labels.recent);
  for (const movement of snapshot.recentMovements) {
    const typeLabel = movement.type === "income" ? labels.income : labels.expenses;
    line(
      `${formatDate(movement.date, locale)} · ${typeLabel} · ${movement.categoryName} · ${money(movement.amount, movement.currency)}`,
    );
  }
  if (!snapshot.recentMovements.length) line(labels.noData);

  return pdf;
}
