import { describe, expect, it, vi, beforeEach } from "vitest";
import { type Dispatch, type SetStateAction } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import es from "../../../../messages/es.json";
import en from "../../../../messages/en.json";
import { TranslationsProvider } from "../../../i18n/client";
import { TransfersList } from "./transfers-list";
import type { SerializedAccount } from "../../../core/domain/account";
import type { SerializedTransfer } from "../../../core/domain/transfer";

/**
 * R-11 (task 4.8) — noResults unified into EmptyState.
 *
 * The component is a client component whose date filters live in internal
 * useState. The vitest environment is node (no DOM / testing-library), so the
 * filter-zero branch cannot be driven by events. Instead, `useState` is mocked
 * to force the 4th hook call (dateTo, after showForm/editingTransfer/dateFrom)
 * to a past date, which makes `filtered.length === 0` while
 * `transfers.length > 0` — the exact noResults trigger condition. If the hook
 * order ever changes, this test fails loudly (the 4th useState would no longer
 * be dateTo and the noResults assertion would break).
 *
 * Copy is resolved through the REAL client i18n hooks (TranslationsProvider +
 * useT), so the assertions exercise the true catalog copy per locale and prove
 * the EmptyState title is byte-identical to the pre-change inline text (same
 * key, same catalog value — R-11 "copy identical to baseline").
 */
const mockState = vi.hoisted(() => ({ useStateCall: 0 }));

// The transfers-list module graph pulls in the server-action plumbing
// (transfer-form → ./actions), whose auth session and DB connection parse
// env at MODULE LOAD (MONGODB_URI / AUTH_SECRET). Same isolation pattern as
// transfers/actions.test.ts: those infra modules are mocked, never loaded.
vi.mock("../../../infrastructure/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("../../../infrastructure/db/connection", () => ({
  connectDb: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] => {
      const resolvedInitial =
        typeof initial === "function" ? (initial as () => T)() : initial;
      mockState.useStateCall += 1;
      if (mockState.useStateCall === 4) {
        // Force dateTo to a past date → the filter excludes every transfer.
        return ["2000-01-01" as T, () => {}];
      }
      return actual.useState<T>(resolvedInitial);
    },
  };
});

type Messages = Record<string, Record<string, string>>;

const esMessages = es as unknown as Messages;
const enMessages = en as unknown as Messages;

function transfer(id: string, date: string): SerializedTransfer {
  return {
    id,
    workspaceId: "ws-1",
    sourceAccountId: "acc-1",
    destinationAccountId: "acc-2",
    sourceAmount: { amount: 100000, currency: "COP" },
    destinationAmount: { amount: 100000, currency: "COP" },
    sourceCurrency: "COP",
    destinationCurrency: "COP",
    effectiveExchangeRate: undefined,
    date: new Date(date),
    note: undefined,
    movementIds: undefined,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 0,
  };
}

function renderList(
  messages: Messages,
  locale: string,
  transfers: SerializedTransfer[],
  accounts: SerializedAccount[] = [],
): string {
  return renderToStaticMarkup(
    <TranslationsProvider messages={messages} locale={locale}>
      <TransfersList accounts={accounts} transfers={transfers} />
    </TranslationsProvider>,
  );
}

describe("TransfersList empty states (R-11)", () => {
  beforeEach(() => {
    mockState.useStateCall = 0;
  });

  it("true-empty list renders the existing first-use EmptyState (unchanged)", () => {
    const html = renderList(esMessages, "es", []);

    // First-use / true-empty state preserved: emptyTitle EmptyState, NOT noResults.
    expect(html).toContain(esMessages.Transfers["emptyTitle"]);
    expect(html).toContain(esMessages.Transfers["emptyDescription"]);
    expect(html).not.toContain(esMessages.Common["noResults"]);
  });

  it("filter-zero renders an EmptyState with the Common.noResults title (es)", () => {
    const html = renderList(esMessages, "es", [transfer("t1", "2026-09-15")]);

    // EmptyState heading with the exact catalog copy (byte-identical to baseline).
    expect(html).toContain("<h3");
    expect(html).toContain(esMessages.Common["noResults"]);
    // The old bare <p> noResults band is gone.
    expect(html).not.toContain("py-8 text-center text-sm text-zinc-500");
    // True-empty copy must NOT leak into the filter-zero state.
    expect(html).not.toContain(esMessages.Transfers["emptyTitle"]);
  });

  it("filter-zero copy is identical in English (en)", () => {
    const html = renderList(enMessages, "en", [transfer("t1", "2026-09-15")]);

    expect(html).toContain("<h3");
    expect(html).toContain(enMessages.Common["noResults"]);
    expect(html).not.toContain("py-8 text-center text-sm text-zinc-500");
    expect(html).not.toContain(enMessages.Transfers["emptyTitle"]);
  });
});