// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SummaryCards } from "./summary-cards";

// (jsdom + createRoot pattern of the repo — no testing-library.)
vi.mock("../../i18n/client", () => ({
  useT: () => (key: string, params?: Record<string, string>) => {
    if (!params) return key;
    return `${key} ${JSON.stringify(params)}`;
  },
  useLocale: () => "es",
}));

let mounts: Array<{ root: Root; container: HTMLElement }> = [];

async function renderNode(node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  mounts.push({ root, container });
  return container;
}

afterEach(async () => {
  for (const { root, container } of mounts) {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
  mounts = [];
});

// Zero amounts must never render with a caller sign modifier ("−0 COP"):
// zero is neither income nor expense (founder screenshot report 2026-10-02).
describe("SummaryCards zero-sign contract", () => {
  it("suppresses the caller sign on zero amounts", async () => {
    const container = await renderNode(
      <SummaryCards
        currency="COP"
        monthlyIncome={0}
        monthlyExpenses={0}
        financingInflow={0}
        financingOutflow={0}
        locale="es"
      />,
    );
    expect(container.textContent).not.toMatch(/−\s?0/);
    expect(container.textContent).not.toMatch(/-\s?0/);
  });
});
