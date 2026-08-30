import { CreditGranted } from '../../domain/credit-granted';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { creditGrantedCategory } from '../../domain/synthetic-categories';
import type { CreditGrantedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreditAbono } from '../../domain/credit-granted';
import { splitAbonoCapitalInterest } from './split-abono';
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
 */
export async function addAbono(
  userId: string,
  creditId: string,
  input: AddAbonoInput,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
): Promise<CreditGranted> {
  // Re-fetch via repo — returns CreditGranted instance with pending getter
  const credits = await creditRepo.findByUserId(userId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  // D3: resolve the RECEIVING account (may differ from the credit's account) —
  // validates existence/ownership.
  const account = await accountRepo.findById(userId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // CRED-G-2: pending = totalToPay − Σ abonos; overpayment rejected
  if (input.amount > credit.pending) {
    throw new ConflictError('Abono exceeds pending amount');
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
    await creditRepo.addAbono(userId, creditId, {
      id: abono.id,
      amount: abono.amount.amount,
      date: abono.date,
      accountId: abono.accountId,
      movementId: abono.movementId,
      capitalAmount: abono.capitalAmount?.amount,
      interestAmount: abono.interestAmount?.amount,
      interestMovementId: abono.interestMovementId,
    });

    if (capitalPortion > 0) {
      await movementRepo.create(
        new Movement({
          id: primaryMovementId,
          userId,
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
      );
    }
    if (interestPortion > 0) {
      await movementRepo.create(
        new Movement({
          id: interestMovementId ?? primaryMovementId,
          userId,
          accountId: input.accountId,
          category: creditGrantedCategory('income'),
          type: 'income',
          amount: new Money(interestPortion, input.currency),
          date: input.date,
          context: 'Personal',
          link: { kind: 'creditGrantedAbonoInterest', refId: creditId, opId: ids.generate() },
          createdAt: now,
        }),
      );
    }

    return new CreditGranted(
      {
        id: credit.id,
        userId: credit.userId,
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
      },
      [...credit.abonos, abono],
    );
  }

  // ─── Sale-born credit: legacy single-movement behavior (never split) ───
  const movementId = ids.generate();

  await creditRepo.addAbono(userId, creditId, {
    id: abonoId,
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    movementId,
  });

  // Create income movement (abono = debtor pays back → income on receiving account)
  const movement = new Movement({
    id: movementId,
    userId,
    accountId: input.accountId,
    category: creditGrantedCategory('income'),
    type: 'income',
    amount: new Money(input.amount, input.currency),
    date: input.date,
    // No persisted note: display text derives at render from link.kind.
    // Sale-born credit abono is commercial activity (flows to Business),
    // matching the POS initial payment (D3-bis).
    context: 'Business',
    link: { kind: 'creditGrantedAbono', refId: creditId, opId: ids.generate() },
    createdAt: now,
  });
  await movementRepo.create(movement);

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
      userId: credit.userId,
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
    },
    [...credit.abonos, abono],
  );
}