import {
  CREDIT_CATEGORY_ID,
  CREDIT_GRANTED_CATEGORY_ID,
  TRANSFER_CATEGORY_ID,
  SALE_CATEGORY_ID,
  OPENING_CATEGORY_ID,
  PAYABLE_CATEGORY_ID,
} from '../core/domain/synthetic-categories';
import type { TranslateFn } from './system-note';

/**
 * Presentation-layer resolution of synthetic (system) category labels.
 *
 * Synthetic categories are in-memory constants — never persisted — so the
 * dashboard cannot find them in its real-category map and system movements
 * would fall through to "uncategorized". Their identifiers resolve here to
 * localized labels from the `SystemNotes` message namespace at render time
 * (AGENTS.md i18n rule: no human language persisted for domain-generated
 * concepts).
 */
const SYNTHETIC_LABEL_KEYS: Record<string, string> = {
  [CREDIT_CATEGORY_ID]: 'categoryCredit',
  [CREDIT_GRANTED_CATEGORY_ID]: 'categoryCreditGranted',
  [TRANSFER_CATEGORY_ID]: 'categoryTransfer',
  [SALE_CATEGORY_ID]: 'categorySale',
  [OPENING_CATEGORY_ID]: 'categoryOpening',
  [PAYABLE_CATEGORY_ID]: 'categoryPayable',
};

/**
 * Localized display label for a synthetic category id.
 * Returns undefined when the id is not a well-known synthetic constant
 * (real user categories are resolved elsewhere).
 */
export function syntheticCategoryLabel(
  categoryId: string,
  t: TranslateFn,
): string | undefined {
  const key = SYNTHETIC_LABEL_KEYS[categoryId];
  if (!key) return undefined;
  return t(key);
}
