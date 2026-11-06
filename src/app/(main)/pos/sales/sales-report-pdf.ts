import { jsPDF } from "jspdf";
import type { SerializedSale } from "../../../../core/domain/sale";
import { formatAmount, formatDate } from "../../../../lib/format";
import { summarizeSalesByCurrency } from "./export-csv";

export function buildSalesReportPdf(args: {
  sales: SerializedSale[];
  clientNames: Record<string, string>;
  itemNames: Record<string, string>;
  filters: { dateFrom?: string; dateTo?: string; status?: string; search?: string };
  locale: string;
  labels: Record<string, string>;
}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const left = 14;
  const right = width - 14;
  const maxWidth = right - left;
  let y = 16;
  const ensureSpace = (needed = 8) => {
    if (y + needed > height - 15) {
      pdf.addPage();
      y = 16;
    }
  };
  const line = (value: string, options: { bold?: boolean; indent?: number } = {}) => {
    const indent = options.indent ?? 0;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    const lines = pdf.splitTextToSize(value, maxWidth - indent);
    ensureSpace(lines.length * 5 + 2);
    pdf.text(lines, left + indent, y);
    y += lines.length * 5 + 2;
  };

  pdf.setFontSize(18);
  line(args.labels.reportTitle, { bold: true });
  pdf.setFontSize(9);
  line(`${args.labels.generated}: ${formatDate(new Date(), args.locale)}`);
  line(`${args.labels.period}: ${args.filters.dateFrom || "—"} – ${args.filters.dateTo || "—"}`);
  if (args.filters.status && args.filters.status !== "all") {
    const statusLabel =
      args.filters.status === "paid" ? args.labels.statusPaid : args.labels.statusCredit;
    line(`${args.labels.status}: ${statusLabel ?? args.filters.status}`);
  }
  if (args.filters.search) line(`${args.labels.client}: ${args.filters.search}`);
  y += 3;
  pdf.setDrawColor(160);
  pdf.line(left, y, right, y);
  y += 6;
  line(`${args.labels.salesCount}: ${args.sales.length}`, { bold: true });

  for (const sale of args.sales) {
    const currency = sale.items[0]?.unitPrice.currency;
    if (!currency) throw new Error(`Sale ${sale.id} has no currency`);
    ensureSpace(20);
    line(
      `${formatDate(sale.date, args.locale)} · ${args.clientNames[sale.clientId ?? ""] ?? args.labels.noClient}`,
      { bold: true },
    );
    for (const item of sale.items) {
      line(
        `${item.quantity} ${item.unit} × ${item.itemName ?? args.itemNames[item.itemId] ?? item.itemId} — ${formatAmount(item.subtotal, currency, args.locale)}`,
        { indent: 3 },
      );
    }
    line(
      `${args.labels.total}: ${formatAmount(sale.total, currency, args.locale)}   ${args.labels.paid}: ${formatAmount(sale.total - sale.pending, currency, args.locale)}   ${args.labels.pending}: ${formatAmount(sale.pending, currency, args.locale)}`,
      { indent: 3 },
    );
    y += 2;
  }

  ensureSpace(25);
  pdf.setDrawColor(160);
  pdf.line(left, y, right, y);
  y += 6;
  line(args.labels.salesTotals, { bold: true });
  for (const totals of summarizeSalesByCurrency(args.sales)) {
    line(
      `${totals.currency} — ${args.labels.salesTotal}: ${formatAmount(totals.sales, totals.currency, args.locale)} · ${args.labels.collectedTotal}: ${formatAmount(totals.collected, totals.currency, args.locale)} · ${args.labels.pendingTotal}: ${formatAmount(totals.pending, totals.currency, args.locale)}`,
    );
  }
  return pdf;
}
