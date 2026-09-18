// @vitest-environment jsdom

// FormField contract tests (UX-10 S6, D8). Mixed renderToStaticMarkup and
// jsdom-mounted variants, parity with fields-a11y.test.tsx.

import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { FormField } from "../form-field";

describe("FormField (static markup)", () => {
  it("associates the label with the control via htmlFor/id", () => {
    const input = <input type="text" />;
    const html = renderToStaticMarkup(
      <FormField id="client" label="Client">
        {input}
      </FormField>,
    );

    expect(html).toContain('<label for="client"');
    expect(html).toContain('id="client"');
  });

  it("error → aria-invalid=true, aria-describedby includes the error id and the error <p> renders", () => {
    const html = renderToStaticMarkup(
      <FormField id="initialPayment" label="Payment" error="Too high">
        <input type="number" />
      </FormField>,
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="initialPayment-error"');
    expect(html).toContain('id="initialPayment-error"');
    expect(html).toContain("text-danger");
    expect(html).toContain("Too high");
  });

  it("no error → no aria-invalid, no error-describedby, no error <p>", () => {
    const html = renderToStaticMarkup(
      <FormField id="initialPayment" label="Payment">
        <input type="number" />
      </FormField>,
    );

    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("initialPayment-error");
    expect(html).not.toContain("text-danger");
  });

  it("hint → aria-describedby includes the hint id and the hint <p> renders", () => {
    const html = renderToStaticMarkup(
      <FormField id="clientId" label="Client" hint="Required for credit">
        <input type="text" />
      </FormField>,
    );

    expect(html).toContain('aria-describedby="clientId-hint"');
    expect(html).toContain('id="clientId-hint"');
    expect(html).toContain("Required for credit");
  });

  it("stacks hint and error ids in aria-describedby", () => {
    const html = renderToStaticMarkup(
      <FormField id="f" label="L" error="Bad" hint="Help">
        <input type="text" />
      </FormField>,
    );

    expect(html).toContain('aria-describedby="f-hint f-error"');
  });

  it("showLabel=false renders an aria-hidden span instead of a <label>", () => {
    const html = renderToStaticMarkup(
      <FormField id="row-0" label="Item" showLabel={false}>
        <input type="text" />
      </FormField>,
    );

    expect(html).not.toContain("<label");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Item");
  });

  it("appends the child's own original describedby as fallback", () => {
    const html = renderToStaticMarkup(
      <FormField id="c" label="L" hint="H">
        <input type="text" aria-describedby="extra-id" />
      </FormField>,
    );

    expect(html).toContain('aria-describedby="c-hint extra-id"');
  });

  it("required and disabled propagate to the control", () => {
    const html = renderToStaticMarkup(
      <FormField id="a" label="L" required disabled>
        <input type="text" />
      </FormField>,
    );

    expect(html).toContain("required");
    expect(html).toContain("disabled");
  });
});

describe("FormField (jsdom)", () => {
  const mounted: Array<() => void> = [];

  afterEach(() => {
    mounted.splice(0).forEach((fn) => fn());
  });

  function mount(node: React.ReactNode) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(node));
    mounted.push(() => {
      act(() => root.unmount());
      container.remove();
    });
    return container;
  }

  it("exactly one <label> per visible column pointing at row 0 across rows", () => {
    const rows = mount(
      <div>
        {[0, 1, 2].map((idx) => (
          <FormField key={idx} id={`item-${idx}`} label="Item" showLabel={idx === 0}>
            <input type="text" />
          </FormField>
        ))}
      </div>,
    );

    const labels = rows.querySelectorAll("label");
    expect(labels.length).toBe(1);
    expect(labels[0].getAttribute("for")).toBe("item-0");
    const hiddenHeaders = rows.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenHeaders.length).toBe(2);
  });

  it("a visible label click focuses the control", () => {
    const container = mount(
      <FormField id="click-target" label="Client">
        <input type="text" />
      </FormField>,
    );

    const label = container.querySelector("label")!;
    act(() => {
      // Real-browser label-click focus behavior is driven by the for/id
      // association; here we assert that wiring directly.
      (document.getElementById(label.htmlFor) as HTMLElement)?.focus();
    });
    expect(document.activeElement?.id).toBe("click-target");
  });
});
