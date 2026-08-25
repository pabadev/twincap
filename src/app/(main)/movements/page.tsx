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
import { MongoTransferRepository } from '../../../infrastructure/repositories/transfer-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { MovementsList } from './movements-list';
import { serializeEntities } from '@/lib/serialize';
import type { SerializedMovement } from '../../../core/domain/movement';
import type { Account } from '../../../core/domain/account';
import type { Transfer } from '../../../core/domain/transfer';
import type { TransferLegsInfo } from '../../../lib/system-note';

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

/**
 * D3 remediation: per-transfer endpoint data (account id, name, raw scope)
 * so each movement leg can render a directional note naming the counterpart
 * account and its scope. Transfers whose endpoint account no longer resolves
 * are omitted → the plain fallback template applies.
 */
function buildTransferLegs(
  transfers: Pick<Transfer, 'id' | 'sourceAccountId' | 'destinationAccountId'>[],
  accounts: Account[],
): Record<string, TransferLegsInfo> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const legs: Record<string, TransferLegsInfo> = {};
  for (const tr of transfers) {
    const origin = byId.get(tr.sourceAccountId);
    const destination = byId.get(tr.destinationAccountId);
    if (!origin || !destination) continue;
    legs[tr.id] = {
      origin: { accountId: origin.id, name: origin.name, scope: origin.scope },
      destination: {
        accountId: destination.id,
        name: destination.name,
        scope: destination.scope,
      },
    };
  }
  return legs;
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
  const transferRepo = new MongoTransferRepository();

  const accounts = await listAccounts(user.userId, accountRepo);

  // Fetch movements for all accounts + parent operations for note derivation
  const [
    creditsReceived,
    creditsGranted,
    payables,
    sales,
    clients,
    transfers,
    ...movementsPerAccount
  ] = await Promise.all([
    creditReceivedRepo.findByUserId(user.userId),
    creditGrantedRepo.findByUserId(user.userId),
    payableRepo.findByUserId(user.userId),
    saleRepo.findByUserId(user.userId),
    clientRepo.findByUserId(user.userId),
    transferRepo.findByUserId(user.userId),
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

  const transferLegs = buildTransferLegs(transfers, accounts);

  // Serialize: convert Map to plain object and domain classes to plain objects
  const movementsRecord: Record<string, SerializedMovement[]> = {};
  for (const [key, val] of movementsByAccount) {
    movementsRecord[key] = serializeEntities(val);
  }

  return (
    <MovementsList
      accounts={serializeEntities(accounts)}
      movementsByAccount={movementsRecord}
      refLabels={refLabels}
      transferLegs={transferLegs}
    />
  );
}
