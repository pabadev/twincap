import type { AccountRepository } from "../../core/domain/repositories";
import type { CategoryRepository } from "../../core/domain/repositories";
import { Account } from "../../core/domain/account";
import { Category } from "../../core/domain/category";
import { objectIdGenerator } from "../config/id-generator";

// R5-D4/R5-D5: only the fixed Cash account is seeded. Legacy Nequi accounts
// (removed from the seed) stay in place for existing users but stop being
// fixed; run scripts/unfix-legacy-nequi.mjs to release them.
const FIXED_ACCOUNTS: Array<{ name: string; currency: "COP"; isFixed: true }> = [
  { name: "Efectivo", currency: "COP", isFixed: true },
];

const DEFAULT_CATEGORIES: Array<{ name: string; type: "income" | "expense" }> = [
  // Income
  { name: "Salario", type: "income" },
  { name: "Ventas", type: "income" },
  { name: "Otros ingresos", type: "income" },
  // Expense
  { name: "Comida", type: "expense" },
  { name: "Transporte", type: "expense" },
  { name: "Vivienda", type: "expense" },
  { name: "Servicios", type: "expense" },
  { name: "Otros gastos", type: "expense" },
];

/**
 * Idempotent seeding on registration (design §7).
 * Creates the single fixed Cash account (R5-D5) and eight default categories
 * for a new user. Unique indexes make re-runs safe.
 */
export async function seedUser(
  userId: string,
  accountRepo: AccountRepository,
  categoryRepo: CategoryRepository,
): Promise<void> {
  const now = new Date();

  for (const acct of FIXED_ACCOUNTS) {
    const account = new Account({
      id: objectIdGenerator.generate(),
      userId,
      name: acct.name,
      currency: acct.currency,
      isFixed: acct.isFixed,
      createdAt: now,
    });
    await accountRepo.create(account);
  }

  for (const cat of DEFAULT_CATEGORIES) {
    const category = new Category({
      id: objectIdGenerator.generate(),
      userId,
      name: cat.name,
      type: cat.type,
      createdAt: now,
    });
    await categoryRepo.create(category);
  }
}
