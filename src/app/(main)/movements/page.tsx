import { redirect } from 'next/navigation';
import { listAccounts } from '../../../core/application/accounts';
import { listMovementsPaged, filterMovementsWithLiveParents } from '../../../core/application/movements';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoTransferRepository } from '../../../infrastructure/repositories/transfer-repository';
import { MongoCreditReceivedRepository } from '../../../infrastructure/repositories/credit-received-repository';
import { MongoCreditGrantedRepository } from '../../../infrastructure/repositories/credit-granted-repository';
import { MongoPayableRepository } from '../../../infrastructure/repositories/payable-repository';
import { MongoSaleRepository } from '../../../infrastructure/repositories/sale-repository';
import { MongoClientRepository } from '../../../infrastructure/repositories/client-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { MovementsList } from './movements-list';
import { serializeEntities } from '@/lib/serialize';

const PAGE_SIZE = 50;

/**
 * Counterparty label per parent operation id (credit/sale/payable), used by
 * the movements list to derive localized system-note text at render time
 * (link.kind + counterparty — no human-language text persisted).
 */
function buildRefLabels(
  creditsReceived: { id: string; counterparty: string }[],
  creditsGranted: { id: string; counterparty: string }[],
  payables: { id: string; counterparty: string }[],
  sales: { id: string; clientId?: string }[],
  clientNames: Map<string, string>,
): Record<string, string> {
  const refLabels: Record<string, string> = {};
  for (const c of creditsReceived) refLabels[c.id] = c.counterparty;
  for (const c of creditsGranted) refLabels[c.id] = c.counterparty;
  for (const p of payables) refLabels[p.id] = p.counterparty;
  for (const s of sales) {
    const name = s.clientId ? clientNames.get(s.clientId) : undefined;
    if (name) refLabels[s.id] = name;
  }
  return refLabels;
}

export default async function MovementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDb();
  const movementRepo = new MongoMovementRepository();
  const creditReceivedRepo = new MongoCreditReceivedRepository();
  const creditGrantedRepo = new MongoCreditGrantedRepository();
  const payableRepo = new MongoPayableRepository();
  const saleRepo = new MongoSaleRepository();
  const clientRepo = new MongoClientRepository();
  const transferRepo = new MongoTransferRepository();
  const accountRepo = new MongoAccountRepository();

  // Fetch parent operations for note derivation (needed for refLabels)
  const [creditsReceived, creditsGranted, payables, sales, clients, firstPage, transfers, accounts] =
    await Promise.all([
      creditReceivedRepo.findByWorkspaceId(user.workspaceId!),
      creditGrantedRepo.findByWorkspaceId(user.workspaceId!),
      payableRepo.findByWorkspaceId(user.workspaceId!),
      saleRepo.findByWorkspaceId(user.workspaceId!),
      clientRepo.findByWorkspaceId(user.workspaceId!),
      listMovementsPaged(user.workspaceId!, PAGE_SIZE, movementRepo),
      transferRepo.findByWorkspaceId(user.workspaceId!),
      listAccounts(user.workspaceId!, accountRepo),
    ]);

  // R6-P1: defensive filter — drop movements whose linked parent is gone.
  // Cursor pagination is not recomputed after filtering (orphans are
  // exceptional, so the page may occasionally show fewer than PAGE_SIZE).
  // Kinds that may carry legacy UUID refIds get LinkableParent[] so the
  // filter can fall back to value-based reconciliation (accountId + date + amount).
  const liveParents = {
    accounts: new Set(accounts.map((a) => a.id)),
    transfers: new Set(transfers.map((tr) => tr.id)),
    creditsReceived: creditsReceived.map((c) => ({
      id: c.id,
      accountId: c.accountId,
      date: c.date,
      amount: c.principal.amount,
    })),
    creditsGranted: creditsGranted.map((c) => ({
      id: c.id,
      accountId: c.accountId,
      date: c.date,
      amount: c.principal.amount,
    })),
    sales: sales.map((s) => ({
      id: s.id,
      accountId: s.accountId,
      date: s.date,
      amount: s.total,
    })),
    payables: new Set(payables.map((p) => p.id)),
  };
  firstPage.items = filterMovementsWithLiveParents(firstPage.items, liveParents);

  const refLabels = buildRefLabels(
    creditsReceived,
    creditsGranted,
    payables,
    sales,
    new Map(clients.map((c) => [c.id, c.name])),
  );

  const serializedMovements = serializeEntities(firstPage.items);
  const nextCursor = firstPage.nextCursor
    ? { date: firstPage.nextCursor.date.toISOString(), createdAt: firstPage.nextCursor.createdAt.toISOString() }
    : null;

  return (
    <MovementsList
      initialMovements={serializedMovements}
      nextCursor={nextCursor}
      refLabels={refLabels}
    />
  );
}
