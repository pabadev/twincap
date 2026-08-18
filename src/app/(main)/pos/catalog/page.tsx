import { redirect } from 'next/navigation';
import { listCatalogItems } from '../../../../core/application/catalog';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoCatalogItemRepository } from '../../../../infrastructure/repositories/catalog-repository';
import { CatalogList } from './catalog-list';

const catalogRepo = new MongoCatalogItemRepository();

export default async function CatalogPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const items = await listCatalogItems(user.userId, catalogRepo);

  return <CatalogList items={items} />;
}
