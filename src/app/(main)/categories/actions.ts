"use server";

import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../../core/application/categories";
import type { CreateCategoryInput } from "../../../core/application/categories";
import type { SerializedCategory } from "../../../core/domain/category";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { MongoCategoryRepository } from "../../../infrastructure/repositories/category-repository";
import { MongoMovementRepository } from "../../../infrastructure/repositories/movement-repository";
import { MongoUnitOfWork } from "../../../infrastructure/transactions/mongo-unit-of-work";
import { connectDb } from "../../../infrastructure/db/connection";
import { objectIdGenerator } from "../../../infrastructure/config/id-generator";
import { revalidatePath } from "next/cache";
import { handleActionError } from "../../../lib/handle-action-error";

const ids = objectIdGenerator;

export type CategoryActionResult = {
  error?: string;
  success?: string;
  /** Snapshot of the created category — lets flows like the movement form auto-select it. */
  category?: SerializedCategory;
};

export async function createCategoryAction(
  _prev: CategoryActionResult | null,
  formData: FormData,
): Promise<CategoryActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" };

  const name = formData.get("name") as string;
  const type = formData.get("type") as CreateCategoryInput["type"];

  try {
    await connectDb();
    const categoryRepo = new MongoCategoryRepository();
    const category = await createCategory(user.workspaceId!, { name, type }, categoryRepo, ids);
    revalidatePath("/categories");
    revalidatePath("/movements");
    return { success: "categoryCreated", category: category.toJSON() };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateCategoryAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" };

  const categoryId = formData.get("categoryId") as string;
  const name = formData.get("name") as string;

  try {
    await connectDb();
    const categoryRepo = new MongoCategoryRepository();
    await updateCategory(user.workspaceId!, { categoryId, name }, categoryRepo);
    revalidatePath("/categories");
    revalidatePath("/movements");
  } catch (error) {
    return handleActionError(error);
  }

  return { success: "categoryUpdated" };
}

export async function deleteCategoryAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" };

  const categoryId = formData.get("categoryId") as string;

  try {
    await connectDb();
    const categoryRepo = new MongoCategoryRepository();
    const movementRepo = new MongoMovementRepository();
    await deleteCategory(
      user.workspaceId!,
      categoryId,
      categoryRepo,
      movementRepo,
      new MongoUnitOfWork(),
    );
    revalidatePath("/categories");
    revalidatePath("/movements");
  } catch (error) {
    return handleActionError(error);
  }

  return { success: "categoryDeleted" };
}
