import { redirect } from 'next/navigation';
import { getT } from '../../../i18n/server';
import { listCategories } from '../../../core/application/categories';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { CategoriesPageClient } from './categories-page-client';
import { DeleteCategoryButton } from './delete-category-button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Icon } from '../../../components/ui/icon';
import { Tags } from 'lucide-react';

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getT('Categories');
  const tCommon = await getT('Common');

  await connectDb();
  const categoryRepo = new MongoCategoryRepository();

  const categories = await listCategories(user.userId, categoryRepo);

  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
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
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full min-w-[300px] divide-y divide-zinc-200 dark:divide-zinc-700">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {nameLabel}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {actionsLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {category.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteCategoryButton categoryId={category.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
