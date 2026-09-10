import { CreditGranted } from '../../domain/credit-granted';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors';
import { creditGrantedCategory } from '../../domain/synthetic-categories';
import type { CreditGrantedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';
import type { CreditAbono } from '../../domain/credit-granted';
import { splitAbonoCapitalInterest } from './split-abono';
import { WRITE_OFF_ALREADY_MSG } from './write-off-credit-granted';
import type { AddAbonoInput } from './dto/credits-granted';

/**
 * Add an abono to a credit granted (CRED-G-2, CRED-G-3).
 *
 * Pending = totalToPay − Σ abonos. Overpayment is rejected.
 *
 * R9/D9.1 — capital/interest split at the source: for standalone credits (no
 * POS sale) the abono is split chronologically into a capital-recovery portion
 * (kind `creditGrantedAbono`, NOT economic) and an interest portion (kind
 * `creditGrantedAbonoInterest`, income). 1–2 movements are produced: capital
 * always, interest only when the split has one. In the limit case where the
 * principal is already fully recovered the abono is 100% interest — a single
 * interest movement becomes the primary (movementId) one.
 *
 * The embedded abono keeps its TOTAL amount (pending/totalToPay derivation
 * stays untouched) and gains informative capitalAmount/interestAmount plus the
 * interest-movement link. The primary movement is always the capital one when
 * a capital portion exists.
 *
 * Sale-born credits keep the legacy single-movement behavior — their ledger is
 * owned by the sale flow (salePayment); reaching this path via markAsPaid never
 * splits. They still emit the same kind `creditGrantedAbono` as the standalone
 * path, but with context 'Business' because a sale-born abono is commercial
 * activity (matching the POS initial payment), while the standalone abono is
 * capital recovery and stays 'Personal'.
 *
 * R15 Fase 3: the aggregate read AND the balance/currency validations that
 * derive from it run INSIDE the transaction (snapshot-consistent), and the
 * writes (abono $push + 1–2 movements) commit or roll back atomically. The
 * receiving-account validation stays OUTSIDE the tx — AccountRepository has no
 * transaction handle (static reference resolved up front; matrix row 70).
 */
export async function addAbono(
  workspaceId: string,
  creditId: string,
  input: AddAbonoInput,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<CreditGranted> {
  // D3: resolve the RECEIVING account (may differ from the credit's account) —
  // validates existence/ownership.
  const account = await accountRepo.findById(workspaceId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // ACC-1: the RECEIVING account's currency must match the abono's currency —
  // otherwise the movement would be re-labeled in the account currency on read.
  if (account.currency !== input.currency) {
    throw new ValidationError(
      `Receiving account currency is ${account.currency}, abono is ${input.currency}`,
    );
  }

  return uow.withTransaction(async (tx) => {
    // R15.2: shared-document write — touch the RECEIVING account inside this
    // transaction so a concurrent deleteAccount cannot commit between the
    // aggregate read and the abono/movement inserts, leaving the abono
    // movement(s) orphaned (matrix row 36). The account read above stays
    // outside the tx (static reference resolved up front; matrix row 70).
    const touched = await accountRepo.touch(workspaceId, input.accountId, tx);
    if (!touched) {
      throw new NotFoundError('Account not found');
    }

    // Re-fetch via repo — returns CreditGranted instance with pending getter.
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const credits = await creditRepo.findByWorkspaceId(workspaceId, tx);
    const credit = credits.find(c => c.id === creditId);
    if (!credit) throw new NotFoundError('Credit not found');

    // ACC-1: the abono's currency must match the credit's principal currency.
    if (input.currency !== credit.principal.currency) {
      throw new ValidationError(`Credit currency is ${credit.principal.currency}, declared ${input.currency}`);
    }

    // CRED-G-2: pending = totalToPay − Σ abonos; overpayment rejected
    if (input.amount > credit.pending) {
      throw new ConflictError('Abono exceeds pending amount');
    }

    // R15-F4 (audit §6): a written-off credit must never accept new abonos.
    // Checked on the fresh read inside the tx, so a retry after a concurrent
    // write-off re-reads the marker and aborts instead of revalidating against
    // stale state.
    if (credit.writtenOff) {
      throw new ConflictError(WRITE_OFF_ALREADY_MSG);
    }

    const abonoId = ids.generate();
    const now = new Date();

    // ─── Standalone credit: split capital / interest (R9/D9.1) ─────────
    if (!credit.saleId) {
      const split = splitAbonoCapitalInterest(
        credit.principal.amount,
        [...credit.abonos.map(a => ({ amount: a.amount.amount })), { amount: input.amount }],
      );
      const { capitalAmount: capitalPortion, interestAmount: interestPortion } =
        split[split.length - 1];

      // Primary movement is the capital one; a 100%-interest abono promotes its
      // interest movement to primary.
      const primaryMovementId = ids.generate();
      const interestMovementId =
        capitalPortion > 0 && interestPortion > 0 ? ids.generate() : undefined;

      const abono: CreditAbono = {
        id: abonoId,
        amount: new Money(input.amount, input.currency),
        date: input.date,
        accountId: input.accountId,
        movementId: primaryMovementId,
        capitalAmount: capitalPortion > 0 ? new Money(capitalPortion, input.currency) : undefined,
        interestAmount: interestPortion > 0 ? new Money(interestPortion, input.currency) : undefined,
        interestMovementId,
      };

      // Abono first, then movements (legacy ordering: a mid-way failure leaves
      // the abono embedded without a phantom balance-affecting movement).
      await creditRepo.addAbono(workspaceId, creditId, {
        id: abono.id,
        amount: abono.amount.amount,
        date: abono.date,
        accountId: abono.accountId,
        movementId: abono.movementId,
        capitalAmount: abono.capitalAmount?.amount,
        interestAmount: abono.interestAmount?.amount,
        interestMovementId: abono.interestMovementId,
      }, tx, credit.version);

      if (capitalPortion > 0) {
        await movementRepo.create(
          new Movement({
            id: primaryMovementId,
            workspaceId,
            accountId: input.accountId,
            category: creditGrantedCategory('income'),
            type: 'income',
            amount: new Money(capitalPortion, input.currency),
            date: input.date,
            // No persisted note: display text derives at render from link.kind.
            context: 'Personal',
            link: { kind: 'creditGrantedAbono', refId: creditId, opId: ids.generate() },
            createdAt: now,
          }),
          tx,
        );
      }
      if (interestPortion > 0) {
        await movementRepo.create(
          new Movement({
            id: interestMovementId ?? primaryMovementId,
            workspaceId,
            accountId: input.accountId,
            category: creditGrantedCategory('income'),
            type: 'income',
            amount: new Money(interestPortion, input.currency),
            date: input.date,
            context: 'Personal',
            link: { kind: 'creditGrantedAbonoInterest', refId: creditId, opId: ids.generate() },
            createdAt: now,
          }),
          tx,
        );
      }

      return new CreditGranted(
        {
          id: credit.id,
          workspaceId: credit.workspaceId,
          counterparty: credit.counterparty,
          principal: credit.principal,
          accountId: credit.accountId,
          date: credit.date,
          installments: credit.installments,
          installmentValue: credit.installmentValue,
          frequency: credit.frequency,
          saleId: credit.saleId,
          writtenOff: credit.writtenOff,
          createdAt: credit.createdAt,
          version: credit.version + 1,
        },
        [...credit.abonos, abono],
      );
    }

    // ─── Sale-born credit: legacy single-movement behavior (never split) ───
    const movementId = ids.generate();

    await creditRepo.addAbono(workspaceId, creditId, {
      id: abonoId,
      amount: input.amount,
      date: input.date,
      accountId: input.accountId,
      movementId,
    }, tx, credit.version);

    // Create income movement (abono = debtor pays back → income on receiving account)
    const movement = new Movement({
      id: movementId,
      workspaceId,
      accountId: input.accountId,
      category: creditGrantedCategory('income'),
      type: 'income',
      amount: new Money(input.amount, input.currency),
      date: input.date,
      // No persisted note: display text derives at render from link.kind.
      // Sale-born credit abono is commercial activity (flows to Business),
      // matching the POS initial payment (D3-bis).
      context: 'Business',
      // saleId (when present) keeps the ledger traceable to the originating
      // sale (I12); standalone credits never carry it.
      link: {
        kind: 'creditGrantedAbono',
        refId: creditId,
        saleId: credit.saleId,
        opId: ids.generate(),
      },
      createdAt: now,
    });
    await movementRepo.create(movement, tx);

    // Return updated credit with new abono appended
    const abono = {
      id: abonoId,
      amount: new Money(input.amount, input.currency),
      date: input.date,
      accountId: input.accountId,
      movementId,
    };
    return new CreditGranted(
      {
        id: credit.id,
        workspaceId: credit.workspaceId,
        counterparty: credit.counterparty,
        principal: credit.principal,
        accountId: credit.accountId,
        date: credit.date,
        installments: credit.installments,
        installmentValue: credit.installmentValue,
        frequency: credit.frequency,
        saleId: credit.saleId,
        writtenOff: credit.writtenOff,
        createdAt: credit.createdAt,
        version: credit.version + 1,
      },
      [...credit.abonos, abono],
    );
  });
}