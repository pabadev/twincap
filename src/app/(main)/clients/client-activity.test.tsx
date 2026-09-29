import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SerializedSale } from "../../../core/domain/sale";
import type { SerializedCreditGranted } from "../../../core/domain/credit-granted";
import { ClientActivity } from "./client-activity";

vi.mock("../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));
vi.mock("../pos/sales/sale-detail-modal", () => ({ SaleDetailModal: () => null }));

const sale = {
  id: "sale-1",
  workspaceId: "workspace-1",
  items: [
    {
      itemId: "item-1",
      quantity: 1,
      unitPrice: { amount: 10000, currency: "COP" },
      subtotal: 10000,
    },
  ],
  date: new Date("2026-09-01T12:00:00.000Z"),
  paymentMode: "on-credit",
  accountId: "account-1",
  clientId: "client-1",
  total: 10000,
  deletedAt: undefined,
  stockRestored: false,
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
  version: 0,
  pending: 7000,
  abonos: [],
} as unknown as SerializedSale;

const credit = {
  id: "credit-1",
  workspaceId: "workspace-1",
  counterparty: "Cliente",
  principal: { amount: 7000, currency: "COP" },
  accountId: "account-1",
  date: new Date("2026-09-01T12:00:00.000Z"),
  totalToPay: 7000,
  saleId: "sale-1",
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
  version: 0,
  pending: 7000,
  abonos: [],
} as unknown as SerializedCreditGranted;

describe("ClientActivity linked history", () => {
  it("links a sale only to the credit whose saleId matches", () => {
    const html = renderToStaticMarkup(
      createElement(ClientActivity, { sales: [sale], credits: [credit] }),
    );
    expect(html).toContain("/credits/granted?highlight=credit-1");
    expect(html).toContain('data-id="credit-1"');
  });

  it("does not show a credit action when the sale has no linked credit", () => {
    const html = renderToStaticMarkup(
      createElement(ClientActivity, { sales: [sale], credits: [] }),
    );
    expect(html).not.toContain("/credits/granted?highlight=");
  });
});
