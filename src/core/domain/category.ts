import { ValidationError } from "./errors";

export const CATEGORY_TYPES = ["income", "expense"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export function isCategoryType(value: string): value is CategoryType {
  return (CATEGORY_TYPES as readonly string[]).includes(value);
}

export interface CategoryInput {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  createdAt: Date;
}

export class Category {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  /** Type-scoped and immutable (CAT-2). Name unique per user+type is a repo concern. */
  readonly type: CategoryType;
  readonly createdAt: Date;

  constructor(input: CategoryInput) {
    if (input.id.length === 0) {
      throw new ValidationError("Category id must not be empty");
    }
    if (input.userId.length === 0) {
      throw new ValidationError("Category userId must not be empty");
    }
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError("Category name must not be empty");
    }
    if (!isCategoryType(input.type)) {
      throw new ValidationError(`Unknown category type: ${String(input.type)}`);
    }
    this.id = input.id;
    this.userId = input.userId;
    this.name = name;
    this.type = input.type;
    this.createdAt = input.createdAt;
  }
}
