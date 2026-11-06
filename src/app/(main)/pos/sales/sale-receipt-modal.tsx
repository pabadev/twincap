"use client";

import { useEffect, useState } from "react";
import { useLocale, useT } from "../../../../i18n/client";
import { Modal } from "../../../../components/ui/modal";
import { Button } from "../../../../components/ui/button";
import { getSaleDetailAction } from "./actions";
import { createSaleReceiptPdf, type ReceiptFormat } from "./sale-receipt";
import type { SaleDetailSnapshot } from "../../../../core/application/sales";
import { formatAmount } from "../../../../lib/format";
import { formatDate } from "../../../../lib/format";

export function SaleReceiptModal({
  saleId,
  onClose,
}: {
  saleId: string | null;
  onClose: () => void;
}) {
  const t = useT("Sales");
  const locale = useLocale();
  const [sale, setSale] = useState<SaleDetailSnapshot | null>(null);
  const [format, setFormat] = useState<ReceiptFormat>("58mm");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setSale(null);
    setPreviewOpen(false);
    if (!saleId) return;
    let cancelled = false;
    getSaleDetailAction(saleId).then((result) => {
      if (!cancelled && result.ok) setSale(result.sale);
    });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const buildPdf = () => sale && createSaleReceiptPdf(sale, format, locale);
  const showPreview = () => setPreviewOpen(true);
  const receiptHtml = sale ? buildReceiptHtml(sale, format, locale) : "";

  return (
    <Modal open={Boolean(saleId)} onClose={onClose} title={t("receiptView")} size="lg">
      <div className="space-y-4">
        <label className="block text-sm font-medium">
          <span className="mb-1 block">{t("receiptSize")}</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ReceiptFormat)}
            className="h-10 w-full rounded-md border border-surface-border bg-surface-input px-3"
          >
            <option value="58mm">58 mm</option>
            <option value="80mm">80 mm</option>
            <option value="letter">{t("letterSize")}</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={showPreview}>
            {t("receiptPreview")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => buildPdf()?.save(`venta-${sale?.id.slice(-8)}-${format}.pdf`)}
            disabled={!sale}
          >
            {t("receiptDownload")}
          </Button>
          <Button
            onClick={() => {
              const pdf = buildPdf();
              if (!pdf) return;
              const printWindow = window.open("", "_blank");
              if (!printWindow) return;
              const url = URL.createObjectURL(pdf.output("blob"));
              printWindow.location.href = url;
              printWindow.addEventListener("load", () => printWindow.print(), { once: true });
            }}
            disabled={!sale}
          >
            {t("receiptPrint")}
          </Button>
        </div>
        {saleId && !sale && (
          <p className="py-8 text-center text-sm text-zinc-500">{t("loadingReceipt")}</p>
        )}
        {previewOpen && sale && (
          <iframe
            title={t("receiptPreview")}
            srcDoc={receiptHtml}
            className="h-[55vh] w-full rounded border border-zinc-300 bg-white"
            sandbox=""
          />
        )}
      </div>
    </Modal>
  );
}

function buildReceiptHtml(sale: SaleDetailSnapshot, format: ReceiptFormat, locale: string) {
  const width = format === "58mm" ? "58mm" : format === "80mm" ? "80mm" : "190mm";
  const itemRows = sale.items
    .map(
      (item) =>
        `<div class="item"><strong>${escapeHtml(item.itemName ?? (locale.startsWith("es") ? "Artículo eliminado" : "Deleted item"))}</strong><div>${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(item.quantity)} × ${escapeHtml(formatAmount(item.unitPrice.amount, item.unitPrice.currency, locale))}<span>${escapeHtml(formatAmount(item.subtotal, sale.currency, locale))}</span></div></div>`,
    )
    .join("");
  const paymentRows =
    sale.paymentMode === "on-credit"
      ? `<div>${locale.startsWith("es") ? "Abonado" : "Paid"}<span>${escapeHtml(formatAmount(sale.total - sale.pending, sale.currency, locale))}</span></div><div>${locale.startsWith("es") ? "Saldo pendiente" : "Balance due"}<span>${escapeHtml(formatAmount(sale.pending, sale.currency, locale))}</span></div>`
      : `<div>${locale.startsWith("es") ? "Pagado" : "Paid in full"}</div>`;
  const date = escapeHtml(formatDate(sale.date, locale));
  const client = escapeHtml(
    sale.clientName ?? (locale.startsWith("es") ? "Cliente general" : "General customer"),
  );
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#eef0f3;color:#111;font:13px/1.4 Arial,sans-serif}.receipt{width:min(100%,${width});margin:0 auto;padding:16px;background:#fff;box-shadow:0 2px 12px #0002}header{text-align:center;border-bottom:1px dashed #888;padding-bottom:10px;margin-bottom:10px}h1{font-size:18px;margin:0 0 6px}.meta{display:flex;justify-content:space-between;gap:8px}.item{padding:8px 0;border-bottom:1px dashed #bbb}.item div, .total, .payments div{display:flex;justify-content:space-between;gap:8px}.item span{white-space:nowrap}.total{padding:10px 0;font-size:16px;font-weight:bold}.payments{border-top:1px dashed #888;padding-top:8px}.payments div{padding:2px 0}footer{text-align:center;padding-top:14px;font-size:12px}@media print{body{padding:0;background:#fff}.receipt{box-shadow:none;margin:0;width:100%}}</style></head><body><main class="receipt"><header><h1>TwinCap</h1><div>Venta ${escapeHtml(sale.id.slice(-8).toUpperCase())}</div><div class="meta"><span>${date}</span></div><div>${client}</div></header>${itemRows}<div class="total"><span>Total</span><span>${escapeHtml(formatAmount(sale.total, sale.currency, locale))}</span></div><section class="payments">${paymentRows}</section><footer>${locale.startsWith("es") ? "Gracias por tu compra" : "Thank you for your purchase"}</footer></main></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
