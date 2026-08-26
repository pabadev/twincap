import { redirect } from 'next/navigation';
import { listAccounts } from '../../../core/application/accounts';
import { listMovementsPaged } from '../../../core/application/movements';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoCreditReceivedRepository } from '../../../infrastructure/repositories/credit-received-repository';
import { MongoCreditGrantedRepository } from '../../../infrastructure/repositories/credit-granted-repository';
import { MongoPayableRepository } from '../../../infrastructure/repositories/payable-repository';
import { MongoSaleRepository } from '../../../infrastructure/repositories/sale-repository';
import { MongoClientRepository } from '../../../infrastructure/repositories/client-repository';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { MovementsList } from './movements-list';
import { serializeEntities } from '@/lib/serialize';
import type { SerializedMovement } from '../../../core/domain/movement';

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

  // Fetch parent operations for note derivation (needed for refLabels)
  const [creditsReceived, creditsGranted, payables, sales, clients, firstPage] =
    await Promise.all([
      creditReceivedRepo.findByUserId(user.userId),
      creditGrantedRepo.findByUserId(user.userId),
      payableRepo.findByUserId(user.userId),
      saleRepo.findByUserId(user.userId),
      clientRepo.findByUserId(user.userId),
      listMovementsPaged(user.userId, PAGE_SIZE, movementRepo),
    ]);

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
