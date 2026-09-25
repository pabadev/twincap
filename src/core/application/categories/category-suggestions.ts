import type { CategoryType } from "../../domain/category";

export interface CategorySuggestionDefinition {
  id: string;
  type: CategoryType;
  labelKey: string;
}

/** Curated optional categories for common Latin American household and business activity. */
export const CATEGORY_SUGGESTIONS: readonly CategorySuggestionDefinition[] = [
  { id: "salary", type: "income", labelKey: "incomeSalary" },
  { id: "sales", type: "income", labelKey: "incomeSales" },
  { id: "freelance", type: "income", labelKey: "incomeFreelance" },
  { id: "professional-services", type: "income", labelKey: "incomeServices" },
  { id: "commissions", type: "income", labelKey: "incomeCommissions" },
  { id: "rental-income", type: "income", labelKey: "incomeRental" },
  { id: "investment-income", type: "income", labelKey: "incomeInvestments" },
  { id: "remittances-received", type: "income", labelKey: "incomeRemittances" },
  { id: "family-support", type: "income", labelKey: "incomeFamilySupport" },
  { id: "other-income", type: "income", labelKey: "incomeOther" },
  { id: "groceries", type: "expense", labelKey: "expenseGroceries" },
  { id: "dining-out", type: "expense", labelKey: "expenseDining" },
  { id: "housing-rent", type: "expense", labelKey: "expenseHousing" },
  { id: "utilities", type: "expense", labelKey: "expenseUtilities" },
  { id: "phone-internet", type: "expense", labelKey: "expenseConnectivity" },
  { id: "transport", type: "expense", labelKey: "expenseTransport" },
  { id: "fuel", type: "expense", labelKey: "expenseFuel" },
  { id: "health", type: "expense", labelKey: "expenseHealth" },
  { id: "education", type: "expense", labelKey: "expenseEducation" },
  { id: "childcare", type: "expense", labelKey: "expenseChildcare" },
  { id: "household", type: "expense", labelKey: "expenseHousehold" },
  { id: "clothing", type: "expense", labelKey: "expenseClothing" },
  { id: "personal-care", type: "expense", labelKey: "expensePersonalCare" },
  { id: "debt-interest", type: "expense", labelKey: "expenseDebtInterest" },
  { id: "bank-fees", type: "expense", labelKey: "expenseBankFees" },
  { id: "taxes", type: "expense", labelKey: "expenseTaxes" },
  { id: "remittances-sent", type: "expense", labelKey: "expenseRemittances" },
  { id: "subscriptions", type: "expense", labelKey: "expenseSubscriptions" },
  { id: "other-expense", type: "expense", labelKey: "expenseOther" },
] as const;

export function isCategorySuggestionId(value: string): boolean {
  return CATEGORY_SUGGESTIONS.some((suggestion) => suggestion.id === value);
}

export function getCategorySuggestion(value: string) {
  return CATEGORY_SUGGESTIONS.find((suggestion) => suggestion.id === value);
}
