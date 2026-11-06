import { jsPDF } from "jspdf";
import { formatAmount, formatDate } from "../../../lib/format";

export interface ClientStatementSale {
  id: string;
  date: string;
  total: number;
  currency: string;
  pending: number;
  payments: Array<{ amount: number; date: string }>;
}

export function buildClientStatementPdf(args: {
  clientName: string;
  sales: ClientStatementSale[];
  locale: string;
  from?: string;
  to?: string;
  labels: {
    title: string;
    generated: string;
    period: string;
    sale: string;
    total: string;
    payment: string;
    pending: string;
    noActivity: string;
    paymentsNote: string;
    totals: string;
  };
}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const left = 14;
  const right = pdf.internal.pageSize.getWidth() - 14;
  const bottom = pdf.internal.pageSize.getHeight() - 14;
  let y = 16;
  const totals = new Map<string, { sales: number; paid: number; pending: number }>();
  const line = (text: string, bold = false, indent = 0) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    const rows = pdf.splitTextToSize(text, right - left - indent);
    if (y + rows.length * 5 + 2 > bottom) {
      pdf.addPage();
      y = 16;
    }
    pdf.text(rows, left + indent, y);
    y += rows.length * 5 + 2;
  };
  pdf.setFontSize(17);
  line(args.labels.title, true);
  pdf.setFontSize(11);
  line(args.clientName, true);
  pdf.setFontSize(9);
  line(`${args.labels.generated}: ${formatDate(new Date(), args.locale)}`);
  line(`${args.labels.period}: ${args.from || "—"} – ${args.to || "—"}`);
  y += 3;
  for (const sale of args.sales) {
    const entry = totals.get(sale.currency) ?? { sales: 0, paid: 0, pending: 0 };
    const paid = sale.total - sale.pending;
    entry.sales += sale.total;
    entry.paid += paid;
    entry.pending += sale.pending;
    totals.set(sale.currency, entry);
    line(
      `${args.labels.sale} · ${formatDate(sale.date, args.locale)} · ${sale.id.slice(-8)}`,
      true,
    );
    line(`${args.labels.total}: ${formatAmount(sale.total, sale.currency, args.locale)}`, false, 3);
    for (const payment of sale.payments) {
      line(
        `${args.labels.payment} · ${formatDate(payment.date, args.locale)}: ${formatAmount(payment.amount, sale.currency, args.locale)}`,
        false,
        3,
      );
    }
    line(
      `${args.labels.pending}: ${formatAmount(sale.pending, sale.currency, args.locale)}`,
      false,
      3,
    );
    y += 2;
  }
  if (args.sales.length === 0) line(args.labels.noActivity);
  y += 3;
  pdf.setDrawColor(180);
  pdf.line(left, y, right, y);
  y += 6;
  line(args.labels.totals, true);
  for (const [currency, totalsForCurrency] of totals) {
    line(
      `${currency} · ${args.labels.total}: ${formatAmount(totalsForCurrency.sales, currency, args.locale)} · ${args.labels.payment}: ${formatAmount(totalsForCurrency.paid, currency, args.locale)} · ${args.labels.pending}: ${formatAmount(totalsForCurrency.pending, currency, args.locale)}`,
    );
  }
  line(args.labels.paymentsNote);
  return pdf;
}
