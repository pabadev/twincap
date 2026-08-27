import { redirect } from 'next/navigation';
import { listSales } from '../../../../core/application/sales';
import { listCatalogItems } from '../../../../core/application/catalog';
import { listClients } from '../../../../core/application/clients';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoSaleRepository } from '../../../../infrastructure/repositories/sale-repository';
import { MongoCatalogItemRepository } from '../../../../infrastructure/repositories/catalog-repository';
import { MongoAccountRepository } from '../../../../infrastructure/repositories/account-repository';
import { MongoClientRepository } from '../../../../infrastructure/repositories/client-repository';
import { MongoCreditGrantedRepository } from '../../../../infrastructure/repositories/credit-granted-repository';
import { connectDb } from '../../../../infrastructure/db/connection';
import { serializeEntities } from '@/lib/serialize';
import { SaleList } from './sale-list';

export default async function SalesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDb();
  const saleRepo = new MongoSaleRepository();
  const catalogRepo = new MongoCatalogItemRepository();
  const accountRepo = new MongoAccountRepository();
  const clientRepo = new MongoClientRepository();
  const creditRepo = new MongoCreditGrantedRepository();

  const [sales, catalogItems, accounts, clients, creditsGranted] = await Promise.all([
    listSales(user.userId, saleRepo),
    listCatalogItems(user.userId, catalogRepo),
    accountRepo.findByUserId(user.userId),
    listClients(user.userId, clientRepo),
    creditRepo.findByUserId(user.userId),
  ]);

  // H14/R5-D0b: linked credits own the pending of their sale AND their first
  // abono IS the sale's initial payment. The list uses these values so both
  // modules always show the same balance, and direct abonos are routed to
  // Credits Granted (single ledger → no double accounting).
  const creditPendingBySaleId: Record<string, number> = {};
  const creditInitialPaymentBySaleId: Record<string, number> = {};
  for (const credit of creditsGranted) {
    if (credit.saleId) {
      creditPendingBySaleId[credit.saleId] = credit.pending;
      creditInitialPaymentBySaleId[credit.saleId] = credit.abonos[0]?.amount.amount ?? 0;
    }
  }

  return (
    <SaleList
      sales={serializeEntities(sales)}
      catalogItems={serializeEntities(catalogItems)}
      accounts={serializeEntities(accounts)}
      clients={serializeEntities(clients)}
      creditPendingBySaleId={creditPendingBySaleId}
      creditInitialPaymentBySaleId={creditInitialPaymentBySaleId}
    />
  );
}
