import { redirect } from 'next/navigation';
import { getT } from '../../../i18n/server';
import { listCategories } from '../../../core/application/categories';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { CategoriesPageClient } from './categories-page-client';
import { DeleteCategoryButton } from './delete-category-button';
import { RenameCategoryButton } from './rename-category-button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Icon } from '../../../components/ui/icon';
import { BackButton } from '../../../components/ui/back-button';
import { Table, TableShell, THead, Th, TBody, Td } from '../../../components/ui/table';
import { Tags } from 'lucide-react';

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getT('Categories');
  const tCommon = await getT('Common');

  await connectDb();
  const categoryRepo = new MongoCategoryRepository();

  const categories = await listCategories(user.workspaceId!, categoryRepo);

  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <CategoriesPageClient />
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Tags} size="xl" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="space-y-6">
          <CategorySection title={t('income')} categories={incomeCategories} emptyMessage={t('noIncome')} nameLabel={tCommon('name')} actionsLabel={tCommon('actions')} />
          <CategorySection title={t('expense')} categories={expenseCategories} emptyMessage={t('noExpense')} nameLabel={tCommon('name')} actionsLabel={tCommon('actions')} />
        </div>
      )}
    </div>
  );
}

function CategorySection({
  title,
  categories,
  emptyMessage,
  nameLabel,
  actionsLabel,
}: {
  title: string;
  categories: { id: string; name: string }[];
  emptyMessage: string;
  nameLabel: string;
  actionsLabel: string;
}) {
  if (categories.length === 0) {
    return (
      <div>
        <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
        {title}
      </h2>
      <TableShell>
        <Table className="min-w-[300px]">
          <THead>
            <tr>
              <Th>
                {nameLabel}
              </Th>
              <Th align="right">
                {actionsLabel}
              </Th>
            </tr>
          </THead>
          <TBody>
            {categories.map((category) => (
              <tr key={category.id}>
                <Td>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {category.name}
                  </span>
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-1">
                    <RenameCategoryButton
                      categoryId={category.id}
                      categoryName={category.name}
                    />
                    <DeleteCategoryButton categoryId={category.id} />
                  </div>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
