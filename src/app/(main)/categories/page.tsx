import { redirect } from 'next/navigation';
import { listCategories } from '../../../core/application/categories';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { CategoryForm } from './category-form';
import { DeleteCategoryButton } from './delete-category-button';

const categoryRepo = new MongoCategoryRepository();

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const categories = await listCategories(user.userId, categoryRepo);

  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Categories
        </h1>
      </div>

      {categories.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No categories yet. Create your first category below.
        </p>
      ) : (
        <div className="space-y-6">
          <CategorySection title="Income" categories={incomeCategories} />
          <CategorySection title="Expense" categories={expenseCategories} />
        </div>
      )}

      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          Add Category
        </h2>
        <CategoryForm />
      </div>
    </div>
  );
}

function CategorySection({
  title,
  categories,
}: {
  title: string;
  categories: { id: string; name: string }[];
}) {
  if (categories.length === 0) {
    return (
      <div>
        <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No {title.toLowerCase()} categories yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
        {title}
      </h2>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Name
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Actions
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
