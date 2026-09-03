import { describe, expect, it } from "vitest";
import { Transfer } from "../../core/domain/transfer";
import { Money } from "../../core/domain/money";
import { toTransferDocData } from "./transfer";

function makeTransfer(
  overrides: Partial<{
    movementIds: { expenseId: string; incomeId: string } | undefined;
    createdAt: Date;
  }> = {},
): Transfer {
  const transfer = new Transfer({
    id: "t1",
    workspaceId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    sourceAccountId: "bbbbbbbbbbbbbbbbbbbbbbbb",
    destinationAccountId: "cccccccccccccccccccccccc",
    sourceAmount: new Money(100, "COP"),
    destinationAmount: new Money(100, "COP"),
    sourceCurrency: "COP",
    destinationCurrency: "COP",
    rate: undefined,
    date: new Date("2026-08-27"),
    note: "",
    movementIds: overrides.movementIds,
    createdAt: overrides.createdAt ?? new Date("2026-08-27"),
  });
  return transfer;
}

describe("transfer mapper (R5-B)", () => {
  it("persists movementIds as plain string ids so delete can reverse both legs", () => {
    const transfer = makeTransfer({
      movementIds: { expenseId: "mov-exp-1", incomeId: "mov-inc-1" },
    });

    const data = toTransferDocData(transfer);

    // Movements carry custom string ids (UUIDs), NOT ObjectIds — wrapping
    // them would throw, so they must be stored as plain strings.
    expect(data.movementIds).toEqual({
      expenseId: "mov-exp-1",
      incomeId: "mov-inc-1",
    });
  });

  it("leaves movementIds undefined when the transfer has none", () => {
    const transfer = makeTransfer({ movementIds: undefined });

    const data = toTransferDocData(transfer);

    expect(data.movementIds).toBeUndefined();
  });
});
