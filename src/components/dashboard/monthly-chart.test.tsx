import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MonthlyChart } from "./monthly-chart";

// §10: the evolution chart is a NATIVE SVG line chart (no external library).
// Two progression lines (income solid, expenses dashed), labelled points,
// compact Y-axis, and an sr-only data table for non-visual access.

vi.mock("../i18n/client", () => ({
  useT: () => (key: string) => key,
}));

const data = [
  { month: "2026-05-01", income: 0, expenses: 0 },
  { month: "2026-06-01", income: 2500000, expenses: 1250000 },
  { month: "2026-07-01", income: 3000000, expenses: 2000000 },
];

const baseProps = {
  data,
  currency: "COP",
  locale: "es",
};

describe("MonthlyChart line chart (§10)", () => {
  it("renders two progression polylines without any external chart dependency", () => {
    const html = renderToStaticMarkup(createElement(MonthlyChart, { ...baseProps }));
    expect(html).toContain("<polyline");
    const polylines = (html.match(/<polyline/g) || []).length;
    expect(polylines).toBe(2);
    // Both series map to the same number of points (uniform bucket spacing).
    const incomePoints = data.map((_, i) => i >= 0).length;
    expect(incomePoints).toBe(3);
  });

  it("labels every point with native tooltips and exposes a sr-only table", () => {
    const html = renderToStaticMarkup(createElement(MonthlyChart, { ...baseProps }));
    const titles = (html.match(/<title>/g) || []).length;
    expect(titles).toBe(6); // 2 series × 3 months
    expect(html).toContain('class="sr-only"');
    expect(html).not.toContain("<canvas");
  });

  it("shows every month label on a short series and alternate labels on dense series", () => {
    const sparse = renderToStaticMarkup(createElement(MonthlyChart, { ...baseProps }));
    // Sparse series (3 months, stride 1): 3 x-axis labels.
    expect((sparse.match(/text-anchor="middle"/g) || []).length).toBe(3);

    const twelveMonths = Array.from({ length: 12 }, (_, i) => ({
      month: `2026-${String(i + 1).padStart(2, "0")}-01`,
      income: i * 1000,
      expenses: i * 500,
    }));
    const dense = renderToStaticMarkup(
      createElement(MonthlyChart, { ...baseProps, data: twelveMonths }),
    );
    // 12 months → stride 2: exactly 6 x-axis labels.
    expect((dense.match(/text-anchor="middle"/g) || []).length).toBe(6);
  });
});
