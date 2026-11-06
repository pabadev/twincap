import type { SaleDetailSnapshot } from "../../../../core/application/sales";
import { jsPDF } from "jspdf";
import { formatAmount } from "../../../../lib/format";

export type ReceiptFormat = "58mm" | "80mm" | "letter";

export function createSaleReceiptPdf(
  sale: SaleDetailSnapshot,
  format: ReceiptFormat,
  locale: string,
) {
  const width = format === "58mm" ? 58 : format === "80mm" ? 80 : 215.9;
  const margin = format === "letter" ? 14 : 4;
  const lineHeight = format === "letter" ? 6 : 4;
  const fontSize = format === "letter" ? 10 : 8;
  const estimatedHeight = Math.max(
    80,
    62 + sale.items.length * lineHeight * 3 + sale.abonos.length * lineHeight,
  );
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: format === "letter" ? "letter" : [width, estimatedHeight],
  });
  const contentWidth = width - margin * 2;
  let y = 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(format === "letter" ? 16 : 11);
  pdf.text("TwinCap", width / 2, y, { align: "center" });
  y += lineHeight + 1;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontSize);
  const text = (value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    const lines = pdf.splitTextToSize(value, contentWidth);
    pdf.text(lines, margin, y);
    y += lines.length * lineHeight;
  };
  text(`Venta ${sale.id.slice(-8).toUpperCase()}`, true);
  text(
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(sale.date),
    ),
  );
  text(sale.clientName ?? (locale.startsWith("es") ? "Cliente general" : "General customer"));
  pdf.setDrawColor(150);
  pdf.line(margin, y, width - margin, y);
  y += lineHeight;
  for (const item of sale.items) {
    text(item.itemName ?? (locale.startsWith("es") ? "Artículo eliminado" : "Deleted item"), true);
    const qty = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(item.quantity);
    text(
      `${qty} × ${money(item.unitPrice.amount, item.unitPrice.currency, locale)}  ${money(item.subtotal, sale.currency, locale)}`,
    );
  }
  pdf.line(margin, y, width - margin, y);
  y += lineHeight;
  text(
    `${locale.startsWith("es") ? "Total" : "Total"}: ${money(sale.total, sale.currency, locale)}`,
    true,
  );
  if (sale.paymentMode === "on-credit") {
    text(
      `${locale.startsWith("es") ? "Abonado" : "Paid"}: ${money(sale.total - sale.pending, sale.currency, locale)}`,
    );
    text(
      `${locale.startsWith("es") ? "Saldo pendiente" : "Balance due"}: ${money(sale.pending, sale.currency, locale)}`,
    );
  } else {
    text(locale.startsWith("es") ? "Pagado" : "Paid in full");
  }
  text(locale.startsWith("es") ? "Gracias por tu compra" : "Thank you for your purchase");
  return pdf;
}

function money(amount: number, currency: string, locale: string) {
  return formatAmount(amount, currency, locale);
}
