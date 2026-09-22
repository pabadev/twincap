import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card } from "../card";

// §29: the content wrapper owns the padding. Root `className` must not be
// used for padding (it stacks with the built-in content padding and doubles
// the inset); `contentClassName` replaces the default `p-6`.

function DefaultCard() {
  return <Card>body</Card>;
}

function PaddedCard() {
  return <Card contentClassName="p-4">body</Card>;
}

function TitledCard() {
  return (
    <Card title="Title" contentClassName="p-4">
      body
    </Card>
  );
}

describe("Card contentClassName (§29)", () => {
  it("defaults the content wrapper to p-6", () => {
    const html = renderToStaticMarkup(createElement(DefaultCard));
    expect(html).toContain("p-6");
  });

  it("replaces the content padding via contentClassName", () => {
    const html = renderToStaticMarkup(createElement(PaddedCard));
    expect(html).toContain('"p-4"');
    expect(html).not.toContain('"p-6"');
  });

  it("keeps the title header styled independently of the content padding", () => {
    const html = renderToStaticMarkup(createElement(TitledCard));
    expect(html).toContain("px-6 py-4");
    expect(html).toContain('"p-4"');
  });
});
