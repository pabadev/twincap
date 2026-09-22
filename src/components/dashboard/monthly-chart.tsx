"use client";

import { Card } from "../ui/card";
import { useT } from "../../i18n/client";

interface MonthData {
  month: string;
  income: number;
  expenses: number;
}

interface MonthlyChartProps {
  data: MonthData[];
  currency: string;
  locale: string;
  title?: string;
}

// Native SVG line chart (§10; no external chart library — the app has a
// single chart today; if analytics surfaces multiply, revisit adoption as a
// dependency-policy PR). Income + expense progression over civil months:
// two polylines, labelled points with native tooltips, baseline grid and a
// screen-reader data table for non-visual access.

const W = 600;
const H = 220;
const PAD = { top: 14, right: 14, bottom: 26, left: 52 };

/** Nice ceiling for the Y scale: whole hundreds/thousands magnitude steps. */
function niceMax(value: number): number {
  if (value <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function MonthlyChart({ data, currency, locale, title }: MonthlyChartProps) {
  const t = useT("Dashboard");

  const monthLabelFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const compactFormatter = new Intl.NumberFormat(locale, { notation: "compact" });
  const fullFormatter = new Intl.NumberFormat(locale, { style: "currency", currency });

  const maxY = Math.max(...data.map((d) => Math.max(d.income, d.expenses)), 1);
  const yMax = niceMax(maxY * 1.05);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const toX = (i: number) =>
    PAD.left + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const toY = (value: number) => PAD.top + innerH - (value / yMax) * innerH;

  const linePath = (get: (d: MonthData) => number) =>
    data.map((d, i) => `${toX(i)},${toY(get(d))}`).join(" ");
  const monthName = (monthStr: string) => {
    const [year, month] = monthStr.split("-").map(Number);
    return monthLabelFormatter.format(new Date(year, month - 1));
  };

  // Every other month label on dense series, all labels otherwise.
  const labelStride = data.length > 8 ? 2 : 1;

  return (
    // relative: the sr-only table below is position:absolute (the sr-only
    // utility). Without a positioned ancestor its containing block is the
    // page itself, so it escapes `main`'s overflow-auto, paints far below
    // the last section and stretches documentElement.scrollHeight — the
    // whole-page double scroll + giant blank area (beta round 3, U1).
    <Card className="relative" contentClassName="p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title ?? t("monthlyTrend")}
      </h3>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${t("monthlyTrend")} — ${t("income")} / ${t("expenses")} (${currency})`}
      >
        {/* Baseline grid: zero line + 3 horizontal guides + compact labels. */}
        {[0, 0.25, 0.5, 0.75].map((f) => {
          const y = f === 0 ? toY(0) : PAD.top + innerH * f;
          return (
            <g key={f}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                className={
                  f === 0
                    ? "stroke-zinc-300 dark:stroke-zinc-700"
                    : "text-zinc-200 opacity-60 dark:text-zinc-700"
                }
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={(f === 0 ? toY(0) : PAD.top + innerH * f) + 3}
                textAnchor="end"
                className="fill-zinc-500 text-[10px] tabular-nums dark:fill-zinc-400"
              >
                {compactFormatter.format(yMax * (1 - f))}
              </text>
            </g>
          );
        })}

        {/* Progression lines: income (solid), expenses (dashed). */}
        <polyline
          points={linePath((d) => d.income)}
          fill="none"
          className="stroke-income"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={linePath((d) => d.expenses)}
          fill="none"
          className="stroke-expense"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          strokeLinejoin="round"
        />

        {/* Labelled points with native tooltips. */}
        {data.map((d, i) => (
          <g key={d.month}>
            <circle cx={toX(i)} cy={toY(d.income)} r={3} className="fill-income">
              <title>
                {`${monthName(d.month)} — ${t("income")}: ${
                  d.income > 0 ? `+${fullFormatter.format(d.income)}` : "—"
                }`}
              </title>
            </circle>
            <circle cx={toX(i)} cy={toY(d.expenses)} r={3} className="fill-expense">
              <title>
                {`${monthName(d.month)} — ${t("expenses")}: ${
                  d.expenses > 0 ? `−${fullFormatter.format(d.expenses)}` : "—"
                }`}
              </title>
            </circle>
            {i % labelStride === 0 && (
              <text
                x={toX(i)}
                y={H - 6}
                textAnchor="middle"
                className="fill-zinc-500 text-[10px] dark:fill-zinc-400"
              >
                {monthName(d.month)}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Non-visual access: the same series as screen-reader text. */}
      <table className="sr-only">
        <caption>{t("monthlyTrend")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("income")}</th>
            <th scope="col">{t("expenses")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{monthName(d.month)}</th>
              <td>{d.income > 0 ? `+${fullFormatter.format(d.income)}` : "—"}</td>
              <td>{d.expenses > 0 ? `−${fullFormatter.format(d.expenses)}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex gap-4 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-income" /> {t("income")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-expense" /> {t("expenses")}
        </span>
      </div>
    </Card>
  );
}
