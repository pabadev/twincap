// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogItemCard } from "./catalog-item-card";

function renderCard(type: "product" | "service") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <CatalogItemCard
        name="Artículo de prueba"
        type={type}
        typeLabel={type === "product" ? "Producto" : "Servicio"}
        priceLabel="Precio"
        price="$10.00"
        priceUnit="por unidad"
        stockLabel="Existencias"
        stock={type === "product" ? "8" : null}
        stockUnit="unidades"
        notApplicable="No aplica"
        actions={<span>Acciones</span>}
      />,
    );
  });
  return { container, root };
}

describe("CatalogItemCard", () => {
  let roots: Array<{ root: Root; container: HTMLDivElement }> = [];

  function track(rendered: { container: HTMLDivElement; root: Root }) {
    roots.push(rendered);
    return rendered;
  }

  afterEach(() => {
    for (const { root, container } of roots) {
      act(() => root.unmount());
      container.remove();
    }
    roots = [];
  });

  it("gives products and services the same two-row information body", () => {
    const { container, root } = track(renderCard("product"));
    const productRows = container.querySelectorAll("[data-card-detail]");
    const productBody = container.querySelector("[data-card-details]");
    expect(productRows).toHaveLength(2);
    expect(productBody?.className).toContain("h-[4.75rem]");
    expect(productRows[1].textContent).toContain("8 unidades");

    const service = track(renderCard("service"));
    const serviceRows = service.container.querySelectorAll("[data-card-detail]");
    const serviceBody = service.container.querySelector("[data-card-details]");
    expect(serviceRows).toHaveLength(2);
    expect(serviceBody?.className).toBe(productBody?.className);
    expect(serviceRows[1].textContent).toContain("No aplica");
    expect(service.container.textContent).toContain("Servicio");
  });

  it("provides a stable target and visible highlight for links from receipt history", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    track({ container, root });
    act(() => {
      root.render(
        <CatalogItemCard
          id="item-1"
          highlighted
          name="Artículo de prueba"
          type="product"
          typeLabel="Producto"
          priceLabel="Precio"
          price="$10.00"
          priceUnit="por unidad"
          stockLabel="Existencias"
          stock="8"
          stockUnit="unidades"
          notApplicable="No aplica"
          actions={<span>Acciones</span>}
        />,
      );
    });

    const card = container.querySelector("#catalog-item-item-1");
    expect(card).not.toBeNull();
    expect(card!.className).toContain("border-primary");
    expect(card!.className).toContain("ring-2");
  });

  it("lays action rows out flexibly so up to five actions never overflow", () => {
    const { container } = track(renderCard("product"));
    const footer = container.querySelector("footer");
    expect(footer).not.toBeNull();
    // Action row pattern (sales/movements): flexible wrap, no fixed 5-track
    // grid — a full-width labelled button used to overflow the footer.
    expect(footer!.className).toContain("flex");
    expect(footer!.className).not.toContain("grid-cols-");
  });
});

// Founder rule (ronda final pre-beta, 2026-09-30): the supply card shows the
// plain "No aplica" price row (no long per-card cost text — that moved to the
// group-level note in the catalog list).
describe("CatalogItemCard supply price row (founder 2026-09-30)", () => {
  it("renders the price row as 'No aplica' with NO unit line when supply is configured", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <CatalogItemCard
          name="Insumo de prueba"
          type="product"
          typeLabel="Insumo"
          priceLabel="Precio"
          price="No aplica"
          priceUnit=""
          stockLabel="Stock"
          stock="100"
          stockUnit="unidades"
          notApplicable="No aplica"
          actions={<span>Acciones</span>}
        />,
      );
    });
    const priceRow = container.querySelector('[data-card-detail="price"]')!;
    expect(priceRow.textContent).toContain("No aplica");
    // The (suppressed) unit line must not render an empty <div>.
    const unitNodes = [...priceRow.children].filter((n) => n.textContent === "");
    expect(unitNodes.length).toBe(0);
    act(() => root.unmount());
    container.remove();
  });
});
