import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MovementCard, type CardField } from "../movement-card";

const fields: CardField[] = [
  { key: "date", label: "Fecha", value: "16 jun 2026" },
  {
    key: "amount",
    label: "Monto",
    value: "+50,000",
    className: "text-income",
    primary: true,
  },
  { key: "category", label: "Categoría", value: "Ventas" },
  {
    key: "type",
    label: "Tipo",
    value: "Ingreso",
    className:
      "inline-flex items-center rounded-full bg-income/10 px-2 py-0.5 text-xs font-medium text-income",
  },
];

describe("MovementCard", () => {
  it("renders every field label and value", () => {
    const html = renderToStaticMarkup(createElement(MovementCard, { id: "m1", fields }));
    expect(html).toContain("Fecha");
    expect(html).toContain("16 jun 2026");
    expect(html).toContain("Monto");
    expect(html).toContain("+50,000");
    expect(html).toContain("Categoría");
    expect(html).toContain("Ventas");
    expect(html).toContain("Tipo");
    expect(html).toContain("Ingreso");
  });

  it("applies primary and secondary field typography", () => {
    const html = renderToStaticMarkup(createElement(MovementCard, { id: "m1", fields }));
    // primary fields: text-sm font-medium + color class from the field
    expect(html).toContain("text-sm font-medium");
    expect(html).toContain("text-income");
    // secondary fields: text-xs + zinc color
    expect(html).toContain("text-xs text-zinc-500 dark:text-zinc-400");
    // custom className (badge) is preserved
    expect(html).toContain("bg-income/10");
    expect(html).toContain("rounded-full");
  });

  it("renders the id as a data attribute", () => {
    const html = renderToStaticMarkup(createElement(MovementCard, { id: "mv-42", fields }));
    expect(html).toContain('data-id="mv-42"');
  });

  it("applies the custom wrapper className (sm:hidden variant)", () => {
    const html = renderToStaticMarkup(
      createElement(MovementCard, {
        id: "m1",
        fields,
        className: "sm:hidden",
      }),
    );
    expect(html).toContain("sm:hidden");
  });

  it("renders the actions slot when provided and omits it otherwise", () => {
    const withActions = renderToStaticMarkup(
      createElement(MovementCard, {
        id: "m1",
        fields,
        actions: createElement("button", { type: "button" }, "Editar"),
      }),
    );
    expect(withActions).toContain("Editar");

    const withoutActions = renderToStaticMarkup(createElement(MovementCard, { id: "m1", fields }));
    expect(withoutActions).not.toContain("Editar");
  });

  it("uses the card surface classes from the credits-received card pattern", () => {
    const html = renderToStaticMarkup(createElement(MovementCard, { id: "m1", fields }));
    expect(html).toContain("rounded-lg border border-surface-border bg-surface-card px-4 py-3");
  });
});
