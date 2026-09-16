import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TouchTarget } from "../touch-target";

describe("TouchTarget", () => {
  it("renders a div by default with the 44px hit-area classes (RTT-2)", () => {
    const html = renderToStaticMarkup(<TouchTarget>label</TouchTarget>);
    expect(html).toContain("<div");
    expect(html).toContain("inline-flex");
    expect(html).toContain("min-h-[44px]");
    expect(html).toContain("min-w-[44px]");
    expect(html).toContain("items-center");
    expect(html).toContain("justify-center");
    expect(html).toContain("touch-manipulation");
  });

  it('renders a span when as="span" (inline contexts inside buttons)', () => {
    const html = renderToStaticMarkup(<TouchTarget as="span">icon</TouchTarget>);
    expect(html).toContain("<span");
    expect(html).toContain("min-h-[44px] min-w-[44px]");
  });

  it("merges the caller className after the base classes", () => {
    const html = renderToStaticMarkup(<TouchTarget className="gap-2.5">x</TouchTarget>);
    expect(html).toContain("touch-manipulation gap-2.5");
  });

  it("renders the children unchanged (icon size untouched, SC-RTT-3)", () => {
    const html = renderToStaticMarkup(<TouchTarget>Edit</TouchTarget>);
    expect(html).toContain("Edit");
  });
});
