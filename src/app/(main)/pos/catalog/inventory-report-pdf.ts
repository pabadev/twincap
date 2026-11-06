import { jsPDF } from "jspdf";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import { quantityFromBaseUnits } from "../../../../core/domain/inventory-units";
import { getAvailableComboCount } from "../../../../core/domain/product-combo";
import { formatAmount, formatDate } from "../../../../lib/format";

export function buildInventoryReportPdf(args: {
  items: SerializedCatalogItem[];
  locale: string;
  labels: {
    title: string;
    generated: string;
    item: string;
    quantity: string;
    value: string;
    unknown: string;
    total: string;
    incomplete: string;
    noItems: string;
  };
  unitLabel: (unit: string) => string;
  generatedAt?: Date;
}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const left = 14;
  const right = width - 14;
  let y = 16;
  const line = (text: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    const chunks = pdf.splitTextToSize(text, right - left);
    if (y + chunks.length * 5 + 2 > height - 14) {
      pdf.addPage();
      y = 16;
    }
    pdf.text(chunks, left, y);
    y += chunks.length * 5 + 2;
  };
  const products = args.items.filter((item) => item.type === "product");
  const stockByItemId = new Map(args.items.map((item) => [item.id, item.stock ?? 0]));
  const knownValue = new Map<string, number>();
  let unknownCount = 0;

  pdf.setFontSize(17);
  line(args.labels.title, true);
  pdf.setFontSize(9);
  line(`${args.labels.generated}: ${formatDate(args.generatedAt ?? new Date(), args.locale)}`);
  y += 3;
  for (const item of products) {
    const isCombo = item.comboVersions.length > 0;
    const quantity = isCombo
      ? getAvailableComboCount(item.comboVersions.at(-1)!, stockByItemId)
      : quantityFromBaseUnits(item.stock ?? 0, item.saleUnit);
    let valueLabel = args.labels.unknown;
    if (!isCombo && item.inventoryValueMinor !== null && item.inventoryValueMinor !== undefined) {
      valueLabel = formatAmount(item.inventoryValueMinor, item.unitPrice.currency, args.locale);
      knownValue.set(
        item.unitPrice.currency,
        (knownValue.get(item.unitPrice.currency) ?? 0) + item.inventoryValueMinor,
      );
    } else if (quantity > 0) {
      unknownCount += 1;
    }
    line(
      `${item.name} · ${args.labels.quantity}: ${new Intl.NumberFormat(args.locale, { maximumFractionDigits: 3 }).format(quantity)} ${args.unitLabel(item.saleUnit)} · ${args.labels.value}: ${valueLabel}`,
    );
  }
  if (products.length === 0) line(args.labels.noItems);

  y += 3;
  pdf.setDrawColor(180);
  pdf.line(left, y, right, y);
  y += 6;
  line(args.labels.total, true);
  for (const [currency, value] of knownValue) {
    line(`${currency}: ${formatAmount(value, currency, args.locale)}`);
  }
  line(`${args.labels.incomplete}: ${unknownCount}`);
  line(args.labels.unknown);
  return pdf;
}
