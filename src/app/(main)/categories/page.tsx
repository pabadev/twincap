import { redirect } from "next/navigation";
import { getT } from "../../../i18n/server";
import { listCategories } from "../../../core/application/categories";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { MongoCategoryRepository } from "../../../infrastructure/repositories/category-repository";
import { connectDb } from "../../../infrastructure/db/connection";
import { CategoriesPageClient } from "./categories-page-client";
import { DeleteCategoryButton } from "./delete-category-button";
import { RenameCategoryButton } from "./rename-category-button";
import { EmptyState } from "../../../components/ui/empty-state";
import { Icon } from "../../../components/ui/icon";
import { MovementCard } from "../../../components/ui/movement-card";
import { Tags } from "lucide-react";

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getT("Categories");
  const tCommon = await getT("Common");

  await connectDb();
  const categoryRepo = new MongoCategoryRepository();

  const categories = await listCategories(user.workspaceId!, categoryRepo);

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <CategoriesPageClient />
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Tags} size="xl" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* §22: Ingresos/Gastos side by side on large screens, stacked on
              mobile (real responsive layout, not just scaled-down type). */}
          <CategorySection
            title={t("income")}
            categories={incomeCategories}
            emptyMessage={t("noIncome")}
            nameLabel={tCommon("name")}
          />
          <CategorySection
            title={t("expense")}
            categories={expenseCategories}
            emptyMessage={t("noExpense")}
            nameLabel={tCommon("name")}
          />
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
}: {
  title: string;
  categories: { id: string; name: string }[];
  emptyMessage: string;
  nameLabel: string;
}) {
  if (categories.length === 0) {
    return (
      <div>
        <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
        <EmptyState icon={<Icon icon={Tags} size="lg" />} title={emptyMessage} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
      {/* Cards are the only representation (product decision 2026-09-21). */}
      <div className="space-y-3">
        {categories.map((category) => (
          <MovementCard
            key={category.id}
            id={category.id}
            fields={[
              {
                key: "name",
                label: nameLabel,
                value: category.name,
                primary: true,
              },
            ]}
            actions={
              <div className="flex items-center gap-1">
                <RenameCategoryButton categoryId={category.id} categoryName={category.name} />
                <DeleteCategoryButton categoryId={category.id} />
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}
