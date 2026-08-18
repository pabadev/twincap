import { Category, type CategoryType } from '../domain/category';

/**
 * Well-known synthetic category IDs for system-linked movements.
 * These are ObjectId-compatible (24-char hex) constants.
 * They are NOT persisted in the categories collection — they exist only
 * as in-memory Category objects used by the Movement domain constructor.
 */
const SYNTHETIC_IDS = {
  credit: '000000000000000000000001',
  creditGranted: '000000000000000000000002',
  transfer: '000000000000000000000003',
  sale: '000000000000000000000004',
  opening: '000000000000000000000005',
} as const;

function makeCategory(id: string, name: string, type: CategoryType): Category {
  return new Category({ id, userId: '__system__', name, type, createdAt: new Date(0) });
}

// Key = `${id}:${type}` → supports same ID with different types
const SYNTHETIC_CATEGORIES = new Map<string, Category>([
  [`${SYNTHETIC_IDS.credit}:income`, makeCategory(SYNTHETIC_IDS.credit, 'Credit', 'income')],
  [`${SYNTHETIC_IDS.credit}:expense`, makeCategory(SYNTHETIC_IDS.credit, 'Credit', 'expense')],
  [`${SYNTHETIC_IDS.creditGranted}:income`, makeCategory(SYNTHETIC_IDS.creditGranted, 'Credit granted', 'income')],
  [`${SYNTHETIC_IDS.creditGranted}:expense`, makeCategory(SYNTHETIC_IDS.creditGranted, 'Credit granted', 'expense')],
  [`${SYNTHETIC_IDS.transfer}:income`, makeCategory(SYNTHETIC_IDS.transfer, 'Transfer', 'income')],
  [`${SYNTHETIC_IDS.transfer}:expense`, makeCategory(SYNTHETIC_IDS.transfer, 'Transfer', 'expense')],
  [`${SYNTHETIC_IDS.sale}:income`, makeCategory(SYNTHETIC_IDS.sale, 'Sale', 'income')],
  [`${SYNTHETIC_IDS.sale}:expense`, makeCategory(SYNTHETIC_IDS.sale, 'Sale', 'expense')],
  [`${SYNTHETIC_IDS.opening}:income`, makeCategory(SYNTHETIC_IDS.opening, 'Opening balance', 'income')],
]);

/**
 * Resolve a synthetic category by ID and movement type.
 * Returns the Category if the ID matches a well-known synthetic constant, null otherwise.
 */
export function resolveSyntheticCategory(categoryId: string, movementType?: CategoryType): Category | null {
  if (!movementType) {
    // Fallback: return the first match (income preferred)
    for (const type of ['income', 'expense'] as CategoryType[]) {
      const cat = SYNTHETIC_CATEGORIES.get(`${categoryId}:${type}`);
      if (cat) return cat;
    }
    return null;
  }
  return SYNTHETIC_CATEGORIES.get(`${categoryId}:${movementType}`) ?? null;
}

/**
 * Check if a category ID is synthetic (system-linked).
 */
export function isSyntheticCategoryId(categoryId: string): boolean {
  return Object.values(SYNTHETIC_IDS).includes(categoryId as typeof SYNTHETIC_IDS[keyof typeof SYNTHETIC_IDS]);
}

// ─── Convenience exports for application layer ─────────────────────

export const CREDIT_CATEGORY_ID = SYNTHETIC_IDS.credit;
export const CREDIT_GRANTED_CATEGORY_ID = SYNTHETIC_IDS.creditGranted;
export const TRANSFER_CATEGORY_ID = SYNTHETIC_IDS.transfer;
export const SALE_CATEGORY_ID = SYNTHETIC_IDS.sale;
export const OPENING_CATEGORY_ID = SYNTHETIC_IDS.opening;

export function creditCategory(type: CategoryType): Category {
  return makeCategory(CREDIT_CATEGORY_ID, 'Credit', type);
}

export function creditGrantedCategory(type: CategoryType): Category {
  return makeCategory(CREDIT_GRANTED_CATEGORY_ID, 'Credit granted', type);
}

export function transferCategory(type: CategoryType): Category {
  return makeCategory(TRANSFER_CATEGORY_ID, 'Transfer', type);
}

export function saleCategory(type: CategoryType): Category {
  return makeCategory(SALE_CATEGORY_ID, 'Sale', type);
}

export function openingCategory(): Category {
  return makeCategory(OPENING_CATEGORY_ID, 'Opening balance', 'income');
}
