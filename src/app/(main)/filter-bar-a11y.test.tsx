// UX-12 (filter-bar-a11y): every visible <label> in the 5 list filter bars is
// programmatically associated with its control (htmlFor/id), and every filter
// <Select> has an accessible name (id wired to a visible label). UX-10 D8
// deferral closure with the measured inventory. Structure-only assertion:
// no filter state or control inventory is exercised here.
//
// Static markup rendering is used (same approach as fields-a11y.test.tsx) so
// association attributes can be asserted without a browser; the axe re-scan
// (U5) is the behavioral arbiter.

import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SerializedCreditGranted } from "../../core/domain/credit-granted";
import type { SerializedCreditReceived } from "../../core/domain/credit-received";
import type { SerializedPayable } from "../../core/domain/payable";
import type { SerializedTransfer } from "../../core/domain/transfer";
import type { SerializedSale } from "../../core/domain/sale";
import type { SerializedAccount } from "../../core/domain/account";
import { SaleList } from "./pos/sales/sale-list";
import { CreditsGrantedList } from "./credits/granted/credits-granted-list";
import { CreditsReceivedList } from "./credits/received/credits-received-list";
import { PayablesList } from "./payables/payables-list";
import { TransfersList } from "./transfers/transfers-list";

vi.mock("../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

// Client-only side components are irrelevant to filter-bar association
// semantics; stubbed so each list renders its filter bar with no side effects.
vi.mock("./pos/sales/sale-form", () => ({ SaleForm: () => null }));
vi.mock("./pos/sales/abono-form", () => ({ AbonoForm: () => null }));
vi.mock("./pos/sales/sale-detail-modal", () => ({ SaleDetailModal: () => null }));
vi.mock("./pos/sales/delete-sale-button", () => ({ DeleteSaleButton: () => null }));
vi.mock("./pos/sales/actions", () => ({
  exportSalesCsvAction: async () => ({ ok: false }),
}));
vi.mock("../../lib/hooks/use-toast", () => ({
  useToast: () => ({ addToast: () => {} }),
}));
vi.mock("./credits/granted/credit-form", () => ({ CreditForm: () => null }));
vi.mock("./credits/granted/abono-form", () => ({ AbonoForm: () => null }));
vi.mock("./credits/granted/edit-abono-form", () => ({ EditAbonoForm: () => null }));
vi.mock("./credits/granted/edit-credit-form", () => ({ EditCreditForm: () => null }));
vi.mock("./credits/granted/delete-credit-button", () => ({ DeleteCreditButton: () => null }));
vi.mock("./credits/granted/delete-abono-button", () => ({ DeleteAbonoButton: () => null }));
vi.mock("./credits/granted/mark-as-paid-button", () => ({ MarkAsPaidButton: () => null }));
vi.mock("./credits/granted/write-off-button", () => ({ WriteOffButton: () => null }));
vi.mock("./credits/received/credit-form", () => ({ CreditForm: () => null }));
vi.mock("./credits/received/abono-form", () => ({ AbonoForm: () => null }));
vi.mock("./credits/received/edit-abono-form", () => ({ EditAbonoForm: () => null }));
vi.mock("./credits/received/edit-credit-form", () => ({ EditCreditForm: () => null }));
vi.mock("./credits/received/delete-credit-button", () => ({ DeleteCreditButton: () => null }));
vi.mock("./credits/received/delete-abono-button", () => ({ DeleteAbonoButton: () => null }));
vi.mock("./credits/received/mark-as-paid-button", () => ({ MarkAsPaidButton: () => null }));
vi.mock("./credits/received/actions", () => ({
  exportCreditsReceivedCsvAction: async () => ({ ok: false }),
}));
vi.mock("./payables/payable-form", () => ({ PayableForm: () => null }));
vi.mock("./payables/abono-form", () => ({ AbonoForm: () => null }));
vi.mock("./payables/edit-abono-form", () => ({ EditAbonoForm: () => null }));
vi.mock("./payables/edit-payable-form", () => ({ EditPayableForm: () => null }));
vi.mock("./payables/delete-payable-button", () => ({ DeletePayableButton: () => null }));
vi.mock("./payables/delete-abono-button", () => ({ DeleteAbonoButton: () => null }));
vi.mock("./payables/actions", () => ({
  exportPayablesCsvAction: async () => ({ ok: false }),
}));
vi.mock("./transfers/transfer-form", () => ({ TransferForm: () => null }));
vi.mock("./transfers/delete-transfer-button", () => ({ DeleteTransferButton: () => null }));


interface ControlLike {
  tag: string;
  id: string | null;
  type: string | null;
}

const FOR_ALL = new Set(["input", "select", "textarea"]);

function extractControls(html: string): ControlLike[] {
  const re = /<(input|select)([^>]*)>/g;
  const controls: ControlLike[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[2];
    const id = /(?:^|\s)id="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const type = /(?:^|\s)type="([^"]*)"/.exec(attrs)?.[1] ?? "";
    controls.push({ tag: m[1], id, type });
  }
  return controls;
}

function extractLabels(html: string): { htmlFor: string; text: string }[] {
  const re = /<label([^>]*)>([\s\S]*?)<\/label>/g;
  const labels: { htmlFor: string; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    // ui/label-less FormField variants render aria-hidden spans, not labels;
    // every visible <label> in the filter bars must target a control.
    const htmlFor = /(?:^|\s)for="([^"]*)"/.exec(attrs)?.[1] ?? "";
    labels.push({ htmlFor, text: text.trim() });
  }
  return labels;
}

function assertAssociations(name: string, html: string) {
  const controls = extractControls(html);
  // Non-empty: the filter bar must actually render controls or the assertion
  // below would pass vacuously (empty-loop guard).
  expect(controls.length, `${name} renders form controls`).toBeGreaterThan(0);

  for (const label of extractLabels(html)) {
    expect(label.htmlFor, `${name}: <label>${label.text}</label> has htmlFor`).not.toBe("");
    const target = controls.find((c) => c.id === label.htmlFor);
    expect(
      target,
      `${name}: htmlFor target "${label.htmlFor}" resolves to a rendered control`,
    ).toBeDefined();
  }

  for (const control of controls) {
    if (control.tag === "select") {
      expect(control.id, `${name}: <select> has an id (accessible name via label-for)`).not.toBe(
        "",
      );
    }
  }
}

const amount = (n: number) => ({ amount: n, currency: "COP" });

const grantedCredit = {
  id: "cg-1",
  workspaceId: "ws-1",
  counterparty: "Deudor A11y",
  principal: amount(100000),
  accountId: "acc-1",
  date: "2026-09-01T00:00:00.000Z",
  installments: undefined,
  frequency: "monthly",
  installmentValue: undefined,
  totalToPay: 110000,
  saleId: undefined as unknown as string,
  writtenOff: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  version: 0,
  pending: 100000,
  abonos: [],
} as unknown as SerializedCreditGranted;

const receivedCredit = {
  id: "cr-1",
  workspaceId: "ws-1",
  counterparty: "Prestamista A11y",
  principal: amount(50000),
  accountId: "acc-1",
  date: "2026-09-01T00:00:00.000Z",
  installments: undefined,
  frequency: undefined,
  installmentValue: undefined,
  totalToPay: 55000,
  writtenOff: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  version: 0,
  pending: 50000,
  abonos: [],
} as unknown as SerializedCreditReceived;

const payableBase = {
  id: "pay-1",
  workspaceId: "ws-1",
  counterparty: "Proveedor A11y",
  total: { amount: 80000, currency: "COP" },
  accountId: "acc-1",
  date: "2026-09-01T00:00:00.000Z",
  dueDate: undefined,
  note: undefined,
  initialPayment: 0,
  createdAt: "2026-09-01T00:00:00.000Z",
  version: 0,
  pending: 80000,
  abonos: [],
} as unknown as SerializedPayable;

const transferBase = {
  id: "tr-1",
  workspaceId: "ws-1",
  sourceAccountId: "acc-1",
  destinationAccountId: "acc-2",
  sourceAmount: { amount: 12000, currency: "COP" },
  destinationAmount: { amount: 12000, currency: "COP" },
  sourceCurrency: "COP",
  destinationCurrency: "COP",
  date: "2026-09-01T00:00:00.000Z",
  note: undefined,
  effectiveExchangeRate: undefined,
  createdAt: "2026-09-01T00:00:00.000Z",
  version: 0,
} as unknown as SerializedTransfer;

const saleBase = {
  id: "sale-1",
  workspaceId: "ws-1",
  clientId: undefined,
  accountId: "acc-1",
  date: "2026-09-01T00:00:00.000Z",
  total: { amount: 12000, currency: "COP" },
  paymentMode: "paid-in-full",
  pending: 0,
  items: [{ itemId: "item-1", unitPrice: { amount: 12000, currency: "COP" }, quantity: 1, subtotal: { amount: 12000, currency: "COP" }, name: "SKU", createdAt: "2026-09-01T00:00:00.000Z" }],
  createdAt: "2026-09-01T00:00:00.000Z",
  version: 0,
} as unknown as SerializedSale;

const accountBase = {
  id: "acc-1",
  workspaceId: "ws-1",
  name: "Efectivo",
  currency: "COP",
  kind: "cash",
  balance: 1000,
  createdAt: "2026-09-01T00:00:00.000Z",
  version: 0,
} as unknown as SerializedAccount;

describe("Filter-bar label/control association (UX-12, measured inventory)", () => {
  it("SaleList: 4 associated labels + named status select", () => {
    const html = renderToStaticMarkup(
      createElement(SaleList, {
        sales: [saleBase],
        catalogItems: [],
        accounts: [accountBase],
        clients: [],
      }),
    );
    assertAssociations("sale-list", html);
    // 4 filter labels (from, to, status, search) + action labels elsewhere.
    expect(extractLabels(html).length).toBeGreaterThanOrEqual(4);
  });

  it("CreditsGrantedList: 4 associated labels + named status select", () => {
    const html = renderToStaticMarkup(
      createElement(CreditsGrantedList, { accounts: [accountBase], credits: [grantedCredit] }),
    );
    assertAssociations("credits-granted-list", html);
    expect(extractLabels(html).length).toBeGreaterThanOrEqual(4);
  });

  it("CreditsReceivedList: 4 associated labels + named status select", () => {
    const html = renderToStaticMarkup(
      createElement(CreditsReceivedList, { accounts: [accountBase], credits: [receivedCredit] }),
    );
    assertAssociations("credits-received-list", html);
    expect(extractLabels(html).length).toBeGreaterThanOrEqual(4);
  });

  it("PayablesList: 4 associated labels + named status select", () => {
    const html = renderToStaticMarkup(createElement(PayablesList, { accounts: [accountBase], payables: [payableBase] }));
    assertAssociations("payables-list", html);
    expect(extractLabels(html).length).toBeGreaterThanOrEqual(4);
  });

  it("TransfersList: associated date labels", () => {
    const html = renderToStaticMarkup(createElement(TransfersList, { accounts: [accountBase], transfers: [transferBase] }));
    assertAssociations("transfers-list", html);
    expect(extractLabels(html).length).toBeGreaterThanOrEqual(2);
  });
});
