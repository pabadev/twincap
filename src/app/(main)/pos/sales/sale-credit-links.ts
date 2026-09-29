export function mapSaleIdsToCreditIds(
  credits: Array<{ id: string; saleId?: string }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const credit of credits) {
    if (credit.saleId) result[credit.saleId] = credit.id;
  }
  return result;
}

export function creditLaunchHref(creditId: string): string {
  return `/credits/granted?highlight=${encodeURIComponent(creditId)}`;
}
