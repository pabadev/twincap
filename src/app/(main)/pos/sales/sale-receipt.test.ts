import { describe, expect, it } from "vitest";
import { createSaleReceiptPdf } from "./sale-receipt";
import type { SaleDetailSnapshot } from "../../../../core/application/sales";

const sale: SaleDetailSnapshot = {
  id: "507f1f77bcf86cd799439011",
  date: new Date("2026-11-06T12:00:00.000Z"),
  clientName: "Cliente de prueba",
  paymentMode: "on-credit",
  status: "pending",
  items: [
    {
      itemName: "Artículo histórico",
      quantity: 2,
      unit: "unit",
      unitPrice: { amount: 12500, currency: "COP" },
      subtotal: 25000,
      inventoryCostMinor: null,
      costTracked: false,
      isService: false,
    },
  ],
  total: 25000,
  version: 0,
  inventoryCostMinor: null,
  grossProfitMinor: null,
  costComplete: false,
  initialPayment: 5000,
  pending: 20000,
  hasLinkedCredit: false,
  abonos: [],
  accountName: "Caja",
  currency: "COP",
  linkedCredit: null,
};

describe("sale receipt PDF", () => {
  it.each(["58mm", "80mm", "letter"] as const)("creates a readable PDF for %s", (format) => {
    const pdf = createSaleReceiptPdf(sale, format, "es-CO");
    const output = pdf.output();
    expect(output.startsWith("%PDF-")).toBe(true);
    expect(output).toContain("Artículo histórico");
    expect(output).toContain("Saldo pendiente");
    expect(output).toContain("99439011");
  });
});
