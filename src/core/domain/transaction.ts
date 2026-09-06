/**
 * Opaque multi-document transaction handle (R14-B).
 *
 * A UnitOfWork (application port) creates it; transactional repository methods
 * accept it as an OPTIONAL trailing parameter and hand it to their adapter's
 * native session. Core only passes the handle through — it never inspects it.
 * The brand is a unique symbol so only adapters can fabricate a real handle.
 */
export const transactionHandleBrand: unique symbol = Symbol("TransactionHandle");

export interface TransactionHandle {
  readonly [transactionHandleBrand]: true;
}