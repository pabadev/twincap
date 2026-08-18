import { redirect } from 'next/navigation';
import { listCatalogItems } from '../../../../core/application/catalog';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoCatalogItemRepository } from '../../../../infrastructure/repositories/catalog-repository';
import { connectDb } from '../../../../infrastructure/db/connection';
import { CatalogList } from './catalog-list';

export default async function CatalogPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDb();
  const catalogRepo = new MongoCatalogItemRepository();
  const items = await listCatalogItems(user.userId, catalogRepo);

  return <CatalogList items={JSON.parse(JSON.stringify(items))} />;
}
