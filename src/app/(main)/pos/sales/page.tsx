import { redirect } from 'next/navigation';
import { listSales } from '../../../../core/application/sales';
import { listCatalogItems } from '../../../../core/application/catalog';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoSaleRepository } from '../../../../infrastructure/repositories/sale-repository';
import { MongoCatalogItemRepository } from '../../../../infrastructure/repositories/catalog-repository';
import { MongoAccountRepository } from '../../../../infrastructure/repositories/account-repository';
import { connectDb } from '../../../../infrastructure/db/connection';
import { SaleList } from './sale-list';

export default async function SalesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDb();
  const saleRepo = new MongoSaleRepository();
  const catalogRepo = new MongoCatalogItemRepository();
  const accountRepo = new MongoAccountRepository();

  const [sales, catalogItems, accounts] = await Promise.all([
    listSales(user.userId, saleRepo),
    listCatalogItems(user.userId, catalogRepo),
    accountRepo.findByUserId(user.userId),
  ]);

  return (
    <SaleList
      sales={JSON.parse(JSON.stringify(sales))}
      catalogItems={JSON.parse(JSON.stringify(catalogItems))}
      accounts={JSON.parse(JSON.stringify(accounts))}
    />
  );
}
