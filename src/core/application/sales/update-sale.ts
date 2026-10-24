import { Sale } from "../../domain/sale";
import { Money, assertSafeMinorUnits } from "../../domain/money";
import { computeLineItemSubtotal } from "../../domain/sale";
import { Movement } from "../../domain/movement";
import { CreditGranted } from "../../domain/credit-granted";
import { creditGrantedCategory } from "../../domain/synthetic-categories";
import { NotFoundError, ConflictError, ValidationError } from "../../domain/errors";
import { isModernRecord } from "../../domain/modern-record";
import type {
  SaleRepository,
  MovementRepository,
  CreditGrantedRepository,
  AccountRepository,
  CategoryRepository,
} from "../../domain/repositories";
import type { UnitOfWork } from "../ports";
import { touchAccount } from "../financial/touch-accounts";
import type { UpdateSaleInput } from "./dto/sales";

/**
 * DOM-1 (freeze exception EXC-2, founder 2026-10-19): edit the unit PRICES of
 * a registered sale — the missing correction path when the recorded total does
 * not match what was actually agreed or collected.
 *
 * Cascades (whole flow inside `uow.withTransaction` — the same atomicity
 * contract as deleteSale/editPrincipal):
 *
 * - paid-in-full (or sale without a live linked credit): the single
 *   `salePayment` income movement is updated to the new total and the
 *   collection account is touched.
 * - on-credit with a live linked credit: the credit's principal is
 *   recalculated from the new total (NEW model: principal = newTotal — the
 *   credit owns the full debt and the initial payment is already its first
 *   abono; LEGACY model: principal = newTotal − upfront) with the SAME guard
 *   as editPrincipal (`newPrincipal ≥ Σ abonos`, so pending can never go
 *   negative). SALE-BORN credits have NO `creditGrantedPrincipal` movement
 *   (create-sale R5-D0b) — nothing to mirror; standalone-style credits that
 *   carry one get it mirrored, and the credit's account is touched.
 *
 * Guards:
 * - Deleted sales cannot be edited (soft-delete is the terminal state).
 * - A written-off credit pins the debt — its sale cannot be re-priced.
 * - Line quantities/snapshots are NOT editable (inventory consumption would
 *   need reversal) — only unit prices move.
 * - The amounts ALREADY collected can never exceed the new total (embedded
 *   abonos for legacy sales, credit abonos for sale-born credits).
 * - CAS on both aggregates (`__v`): a concurrent abono/edit aborts with
 *   ConflictError and the driver retry re-evaluates everything on fresh state.
 */
export async function updateSale(
  workspaceId: string,
  saleId: string,
  input: UpdateSaleInput,
  saleRepo: SaleRepository,
  movementRepo: MovementRepository,
  creditRepo: CreditGrantedRepository,
  accountRepo: AccountRepository,
  categoryRepo: CategoryRepository,
  uow: UnitOfWork,
): Promise<Sale> {
  return uow.withTransaction(async (tx) => {
    // Tenant-scoped read INSIDE the transaction (snapshot-consistent guards).
    const sale = await saleRepo.findById(workspaceId, saleId, tx);
    if (!sale) throw new NotFoundError("Sale not found");
    if (sale.deletedAt) {
      throw new ConflictError("Deleted sales cannot be edited");
    }
    // CAS guard: the version the client READ (when provided) — a stale modal
    // (another edit landed since it loaded) aborts instead of overwriting.
    const expectedVersion = input.version ?? sale.version;
    if (expectedVersion !== sale.version) {
      throw new ConflictError("Sale was modified by another operation");
    }

    // ACC-1: prices are re-validated against the collection account's currency.
    const account = await accountRepo.findById(workspaceId, sale.accountId, tx);
    if (!account) throw new NotFoundError("Account not found");
    if (input.currency !== account.currency) {
      throw new ValidationError(
        `Account currency is ${account.currency}, declared ${input.currency}`,
      );
    }

    if (input.unitPrices.length !== sale.items.length) {
      throw new ValidationError(
        `Expected ${sale.items.length} unit prices, got ${input.unitPrices.length}`,
      );
    }
    for (const price of input.unitPrices) {
      if (!Number.isSafeInteger(price) || price <= 0) {
        throw new ValidationError("Unit price must be a positive amount");
      }
    }

    // Rebuild the line items with the new prices — quantities, stock
    // consumption and cost snapshots are preserved verbatim (only prices
    // move the total).
    const updatedItems = sale.items.map((item, index) => {
      const newPrice = new Money(input.unitPrices[index], input.currency);
      return {
        ...item,
        unitPrice: newPrice,
        subtotal: computeLineItemSubtotal(item.quantity, newPrice, item.unit),
      };
    });

    // Linked credit (sale-born debt) — read inside the same transaction.
    const credits = await creditRepo.findByWorkspaceId(workspaceId, tx);
    const linkedCredit = credits.find((c) => c.saleId === sale.id) ?? null;

    // ALL total guards run BEFORE any entity construction (fail-fast, no
    // side effects — the Sale constructor has its own overpayment guard but
    // the user-facing conflict must be the collected-amounts one).
    const newTotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
    assertSafeMinorUnits(newTotal, "UpdateSale total");

    let newPrincipal = 0;

    // Sale-embedded abonos (legacy on-credit model): the total can never drop
    // below what was already collected on the sale itself.
    if (linkedCredit === null) {
      const embeddedAbonos = sale.abonos.reduce((sum, a) => sum + a.amount.amount, 0);
      assertSafeMinorUnits(embeddedAbonos, "UpdateSale embedded abonos sum");
      if (newTotal < embeddedAbonos) {
        throw new ConflictError("New total is less than the amounts already collected");
      }
    }

    if (linkedCredit !== null) {
      if (linkedCredit.writtenOff) {
        throw new ConflictError("The linked credit was written off and cannot be edited");
      }
      // R5-A dual-model (founder repro 2026-10-19: venta 25.000 a crédito con
      // pago inicial 20.000, renegociada a 20.000 → pendiente debe quedar 0):
      // - NEW model (principal === total): the credit OWNS THE FULL DEBT —
      //   the initial payment is already its first abono, so it is NOT
      //   deducted again. The new principal is simply the NEW total (guard:
      //   newTotal ≥ Σ abonos keeps pending ≥ 0).
      // - LEGACY model (net principal = total − upfront): the upfront was
      //   never an abono, so the new principal deducts it once.
      if (linkedCredit.principal.amount === sale.total) {
        newPrincipal = newTotal;
      } else {
        newPrincipal = newTotal - (sale.total - linkedCredit.principal.amount);
      }
      assertSafeMinorUnits(newPrincipal, "UpdateSale new principal");
      const creditAbonoSum = linkedCredit.abonos.reduce((sum, a) => sum + a.amount.amount, 0);
      assertSafeMinorUnits(creditAbonoSum, "UpdateSale credit abonos sum");
      if (newPrincipal < creditAbonoSum) {
        throw new ConflictError("New total is less than the amounts already collected");
      }
    }

    const updatedSale = new Sale(
      {
        id: sale.id,
        workspaceId: sale.workspaceId,
        items: updatedItems,
        date: sale.date,
        paymentMode: sale.paymentMode,
        accountId: sale.accountId,
        clientId: sale.clientId,
        createdAt: sale.createdAt,
        version: expectedVersion + 1,
      },
      [...sale.abonos],
    );

    // R15.3.2: set when a movement was actually written — only then does an
    // account's derived balance change and need a touch.
    let touchedAccountId: string | null = null;

    if (linkedCredit !== null) {
      // Credit aggregate write (CAS on the version read in-tx).
      const updatedCredit = new CreditGranted(
        {
          id: linkedCredit.id,
          workspaceId: linkedCredit.workspaceId,
          counterparty: linkedCredit.counterparty,
          principal: new Money(newPrincipal, input.currency),
          accountId: linkedCredit.accountId,
          date: linkedCredit.date,
          installments: linkedCredit.installments,
          installmentValue: linkedCredit.installmentValue,
          frequency: linkedCredit.frequency,
          saleId: linkedCredit.saleId,
          createdAt: linkedCredit.createdAt,
          version: linkedCredit.version + 1,
        },
        [...linkedCredit.abonos],
      );
      await creditRepo.update(updatedCredit, tx, linkedCredit.version);

      // RCA 2026-10-19 (founder repro): a SALE-BORN credit has NO
      // `creditGrantedPrincipal` movement BY DESIGN (create-sale R5-D0b — a
      // POS sale is not financing; only the initial-payment abono movement
      // exists). Its absence here is therefore LEGITIMATE, not an integrity
      // violation: the cascade updates the credit aggregate only. Only
      // standalone-style data would carry that movement; if one somehow
      // exists (defensive), it is mirrored — its account gets touched.
      const movements = await movementRepo.findByWorkspaceId(workspaceId);
      const principalMovement = movements.find(
        (m) => m.link?.kind === "creditGrantedPrincipal" && m.link?.refId === linkedCredit.id,
      );
      if (principalMovement) {
        await movementRepo.update(
          new Movement({
            id: principalMovement.id,
            workspaceId: principalMovement.workspaceId,
            accountId: principalMovement.accountId,
            category: creditGrantedCategory("expense"),
            type: "expense",
            amount: new Money(newPrincipal, input.currency),
            date: principalMovement.date,
            note: principalMovement.note,
            context: principalMovement.context,
            link: principalMovement.link,
            createdAt: principalMovement.createdAt,
          }),
          tx,
        );
        touchedAccountId = principalMovement.accountId;
      }
    } else {
      // Paid-in-full (or legacy embedded-abono sale): the salePayment income
      // movement IS the sale's collection — update it to the new total.
      const movements = await movementRepo.findByWorkspaceId(workspaceId);
      const paymentMovement = movements.find(
        (m) => m.link?.kind === "salePayment" && m.link?.refId === sale.id,
      );
      if (!paymentMovement) {
        if (isModernRecord(sale.createdAt)) {
          throw new ConflictError("Required movement not found for modern record");
        }
        console.warn("[reconcile] Legacy record missing movement, continuing", {
          aggregateId: sale.id,
          kind: "salePayment",
        });
      } else {
        // The salePayment movement keeps ITS OWN user category — re-fetch it
        // to satisfy the Movement constructor (same discipline as
        // updateMovement's unchanged-category re-fetch).
        const originalCategory = await categoryRepo.findById(
          workspaceId,
          paymentMovement.categoryId,
          tx,
        );
        if (!originalCategory) throw new NotFoundError("Category not found");
        await movementRepo.update(
          new Movement({
            id: paymentMovement.id,
            workspaceId: paymentMovement.workspaceId,
            accountId: paymentMovement.accountId,
            category: originalCategory,
            type: paymentMovement.type,
            amount: new Money(newTotal, input.currency),
            date: paymentMovement.date,
            note: paymentMovement.note,
            context: paymentMovement.context,
            link: paymentMovement.link,
            createdAt: paymentMovement.createdAt,
          }),
          tx,
        );
        touchedAccountId = paymentMovement.accountId;
      }
    }

    // Sale aggregate write (CAS on the expected version) — after the movement
    // writes, before the account touch.
    await saleRepo.update(updatedSale, tx, expectedVersion);

    // Account touch is the LAST write (shared-document conflict point,
    // R15.1-6e) — only when a movement was actually written.
    if (touchedAccountId) {
      await touchAccount(accountRepo, workspaceId, touchedAccountId, tx);
    }

    return updatedSale;
  });
}
