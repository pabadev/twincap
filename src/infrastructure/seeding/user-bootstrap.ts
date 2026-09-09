import type { AccountRepository } from "../../core/domain/repositories";
import type { CategoryRepository } from "../../core/domain/repositories";
import type { WorkspaceBootstrapper } from "../../core/application/ports";
import { Account } from "../../core/domain/account";
import { Category } from "../../core/domain/category";
import { objectIdGenerator } from "../config/id-generator";
import type { TransactionHandle } from "../../core/domain/transaction";

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
 *
 * R15-F6: an optional trailing `tx?` lets the seed join the register
 * transaction (account + category creates become atomic with the user, the
 * workspace and the membership). When `tx` is absent the behavior is unchanged.
 */
export async function seedUser(
  workspaceId: string,
  accountRepo: AccountRepository,
  categoryRepo: CategoryRepository,
  tx?: TransactionHandle,
): Promise<void> {
  const now = new Date();

  for (const acct of FIXED_ACCOUNTS) {
    const account = new Account({
      id: objectIdGenerator.generate(),
      workspaceId,
      name: acct.name,
      currency: acct.currency,
      isFixed: acct.isFixed,
      createdAt: now,
    });
    await accountRepo.create(account, tx);
  }

  for (const cat of DEFAULT_CATEGORIES) {
    const category = new Category({
      id: objectIdGenerator.generate(),
      workspaceId,
      name: cat.name,
      type: cat.type,
      createdAt: now,
    });
    await categoryRepo.create(category, tx);
  }
}

/**
 * R14-K §14a: infrastructure adapter for the `WorkspaceBootstrapper` port.
 * Wraps `seedUser` so the register use case (core) depends only on the port,
 * never on this module. Keeps the seeding logic in one place.
 */
export class MongoWorkspaceBootstrapper implements WorkspaceBootstrapper {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly categoryRepo: CategoryRepository,
  ) {}

  async bootstrap(workspaceId: string, tx?: TransactionHandle): Promise<void> {
    await seedUser(workspaceId, this.accountRepo, this.categoryRepo, tx);
  }
}
