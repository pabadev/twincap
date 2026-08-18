/** Synthetic Category for sale-linked movements. */
export function saleCategory(id: string, type: 'income' | 'expense') {
  return { id, userId: '', name: 'Sale', type, createdAt: new Date() };
}
