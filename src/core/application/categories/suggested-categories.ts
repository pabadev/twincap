import { Category } from "../../domain/category";
import { ConflictError } from "../../domain/errors";
import type { CategoryType } from "../../domain/category";
import type { CategoryRepository } from "../../domain/repositories";
import type { IdGenerator } from "../ports";

export interface CategorySuggestion {
  name: string;
  type: CategoryType;
}

/**
 * Creates selected, workspace-local suggestions. Existing names are kept as-is,
 * and duplicate-key races are treated as already applied so retrying is safe.
 */
export async function createSuggestedCategories(
  workspaceId: string,
  suggestions: CategorySuggestion[],
  categoryRepo: CategoryRepository,
  ids: IdGenerator,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const suggestion of suggestions) {
    const name = suggestion.name.trim();
    const existing = await categoryRepo.findByNameAndType(workspaceId, name, suggestion.type);
    if (existing) {
      skipped += 1;
      continue;
    }

    const category = new Category({
      id: ids.generate(),
      workspaceId,
      name,
      type: suggestion.type,
      createdAt: new Date(),
    });

    try {
      await categoryRepo.create(category);
      created += 1;
    } catch (error) {
      // CAT-2's workspace/name/type unique index resolves concurrent retries.
      if (!(error instanceof ConflictError)) throw error;
      skipped += 1;
    }
  }

  return { created, skipped };
}
