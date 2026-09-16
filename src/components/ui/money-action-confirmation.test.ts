import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MoneyActionConfirmation,
  type MoneyActionConfirmationProps,
} from "./money-action-confirmation";

const baseProps: MoneyActionConfirmationProps = {
  open: true,
  onConfirm: () => {},
  onCancel: () => {},
  title: "Confirm abono",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  variant: "normal",
  detailRows: [{ label: "Amount", value: "50,000" }],
};

function render(overrides: Partial<MoneyActionConfirmationProps> = {}): string {
  return renderToStaticMarkup(
    createElement(MoneyActionConfirmation, { ...baseProps, ...overrides }),
  );
}

describe("MoneyActionConfirmation", () => {
  it("renders nothing when open is false", () => {
    expect(render({ open: false })).toBe("");
  });

  it("renders a labeled dialog with the title and the detail rows (normal variant)", () => {
    const html = render();
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Confirm abono");
    expect(html).toContain("Amount");
    expect(html).toContain("50,000");
  });

  it("renders detail rows in the destination-account variant", () => {
    const html = render({ variant: "destination-account" });
    expect(html).toContain("Amount");
    expect(html).toContain("50,000");
  });

  it("renders detail rows in the f5-negative-balance variant", () => {
    const html = render({ variant: "f5-negative-balance" });
    expect(html).toContain("Amount");
    expect(html).toContain("50,000");
  });

  it("applies the red highlight class to the projected row", () => {
    const html = render({
      variant: "f5-negative-balance",
      projectedNegative: true,
      detailRows: [
        { label: "Current balance", value: "5,000" },
        { label: "Operation", value: "-10,000" },
        { label: "New balance", value: "-5,000", highlight: true },
      ],
    });
    expect(html).toContain("text-red-600");
    expect(html).toContain("-5,000");
  });

  it("shows the warning banner only when f5 variant AND projectedNegative", () => {
    const hidden = render({
      variant: "f5-negative-balance",
      negativeBalanceWarning: "This expense will leave the account balance negative.",
    });
    expect(hidden).not.toContain("This expense will leave the account balance negative.");

    const shown = render({
      variant: "f5-negative-balance",
      negativeBalanceWarning: "This expense will leave the account balance negative.",
      projectedNegative: true,
    });
    expect(shown).toContain("This expense will leave the account balance negative.");
    expect(shown).toContain('role="alert"');
  });

  it("shows the destination account name in the destination-account variant", () => {
    const html = render({
      variant: "destination-account",
      destinationAccountName: "Savings",
    });
    expect(html).toContain("Savings");
  });

  it("does not show the destination account name in the normal variant", () => {
    const html = render({ destinationAccountName: "Savings" });
    expect(html).not.toContain("Savings");
  });

  it("disables both action buttons while loading", () => {
    const html = render({ loading: true });
    // Button maps loading → disabled for the confirm button; the cancel
    // button is disabled explicitly; the Modal close button stays enabled.
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(2);
  });

  it("passes title, confirm and cancel labels through props", () => {
    const html = render({
      title: "Custom title",
      confirmLabel: "Do it",
      cancelLabel: "Not now",
    });
    expect(html).toContain("Custom title");
    expect(html).toContain("Do it");
    expect(html).toContain("Not now");
  });

  it("links the heading to the dialog via aria-labelledby with a generated titleId", () => {
    const html = render();
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/);
    const headingId = html.match(/<h2 id="([^"]+)"/);
    expect(labelledBy).not.toBeNull();
    expect(headingId).not.toBeNull();
    expect(labelledBy?.[1]).toBe(headingId?.[1]);
  });
});
