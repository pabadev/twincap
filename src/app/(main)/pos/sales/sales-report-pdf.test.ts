import { describe, expect, it } from "vitest";
import { buildSalesReportPdf } from "./sales-report-pdf";
import type { SerializedSale } from "../../../../core/domain/sale";

const sale: SerializedSale = {
  id: "sale-1",
  workspaceId: "ws-1",
  items: [
    {
      itemId: "item-1",
      itemName: "Café",
      quantity: 2,
      unit: "unit",
      stockQuantity: 2,
      unitPrice: { amount: 3000, currency: "COP" },
      subtotal: 6000,
      formulaSnapshot: undefined,
      comboSnapshot: undefined,
    },
  ],
  date: new Date("2026-11-05T12:00:00Z"),
  paymentMode: "on-credit",
  accountId: "account-1",
  clientId: "client-1",
  total: 6000,
  deletedAt: undefined,
  pending: 2000,
  abonos: [],
  stockRestored: false,
  createdAt: new Date("2026-11-05T12:00:00Z"),
  version: 0,
};

describe("sales report PDF", () => {
  it("generates a PDF with filtered sale detail and totals", () => {
    const pdf = buildSalesReportPdf({
      sales: [sale],
      clientNames: { "client-1": "María" },
      itemNames: {},
      filters: { dateFrom: "2026-11-01", dateTo: "2026-11-30" },
      locale: "es-CO",
      labels: {
        reportTitle: "Reporte de ventas",
        generated: "Generado",
        period: "Período",
        status: "Estado",
        client: "Cliente",
        noClient: "Cliente general",
        salesCount: "Ventas",
        salesTotals: "Totales",
        salesTotal: "Vendido",
        collectedTotal: "Cobrado",
        pendingTotal: "Pendiente",
        total: "Total",
        paid: "Pagado",
        pending: "Pendiente",
      },
    });
    const output = pdf.output();
    expect(output.startsWith("%PDF-")).toBe(true);
    expect(output).toContain("Reporte de ventas");
    expect(output).toContain("María");
    expect(output).toContain("Café");
    expect(output).toContain("Totales");
    expect(output).toContain("COP");
  });
});
