import { redirect } from 'next/navigation';
import { listAccounts } from '../../../core/application/accounts';
import { listMovements } from '../../../core/application/movements';
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
  const accountRepo = new MongoAccountRepository();
  const movementRepo = new MongoMovementRepository();
  const creditReceivedRepo = new MongoCreditReceivedRepository();
  const creditGrantedRepo = new MongoCreditGrantedRepository();
  const payableRepo = new MongoPayableRepository();
  const saleRepo = new MongoSaleRepository();
  const clientRepo = new MongoClientRepository();
  const categoryRepo = new MongoCategoryRepository();

  const accounts = await listAccounts(user.userId, accountRepo);

  // Fetch movements for all accounts + parent operations for note derivation
  const [
    creditsReceived,
    creditsGranted,
    payables,
    sales,
    clients,
    categories,
    ...movementsPerAccount
  ] = await Promise.all([
    creditReceivedRepo.findByUserId(user.userId),
    creditGrantedRepo.findByUserId(user.userId),
    payableRepo.findByUserId(user.userId),
    saleRepo.findByUserId(user.userId),
    clientRepo.findByUserId(user.userId),
    categoryRepo.findByUserId(user.userId),
    ...accounts.map((account) =>
      listMovements(user.userId, account.id, movementRepo),
    ),
  ]);

  const movementsByAccount = new Map<string, Awaited<ReturnType<typeof listMovements>>>();
  accounts.forEach((account, i) => {
    movementsByAccount.set(account.id, movementsPerAccount[i]);
  });

  const refLabels = buildRefLabels(
    creditsReceived,
    creditsGranted,
    payables,
    sales,
    new Map(clients.map((c) => [c.id, c.name])),
  );

  // Serialize: convert Map to plain object and domain classes to plain objects
  const movementsRecord: Record<string, SerializedMovement[]> = {};
  for (const [key, val] of movementsByAccount) {
    movementsRecord[key] = serializeEntities(val);
  }

  const serializedCategories = categories.map((c) => c.toJSON());

  return (
    <MovementsList
      accounts={serializeEntities(accounts)}
      movementsByAccount={movementsRecord}
      refLabels={refLabels}
      categories={serializedCategories}
    />
  );
}
