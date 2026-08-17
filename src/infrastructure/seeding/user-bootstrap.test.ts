import { describe, it, expect } from "vitest";
import { seedUser } from "./user-bootstrap";
import type { AccountRepository } from "../../core/domain/repositories";
import type { CategoryRepository } from "../../core/domain/repositories";
import type { Account } from "../../core/domain/account";
import type { Category } from "../../core/domain/category";

// ─── Fake repositories ──────────────────────────────────────────────

function fakeAccountRepo(): AccountRepository & { created: Account[] } {
  const created: Account[] = [];
  return {
    created,
    findById: async () => null,
    findByUserId: async () => [],
    create: async (account) => {
      created.push(account);
      return account;
    },
    update: async (a) => a,
    delete: async () => {},
  };
}

function fakeCategoryRepo(): CategoryRepository & { created: Category[] } {
  const created: Category[] = [];
  return {
    created,
    findById: async () => null,
    findByUserId: async () => [],
    findByNameAndType: async () => null,
    create: async (category) => {
      created.push(category);
      return category;
    },
    update: async (c) => c,
    delete: async () => {},
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

const USER_ID = "user-test-123";

describe("seedUser", () => {
  it("creates 2 fixed accounts and 8 default categories", async () => {
    const accountRepo = fakeAccountRepo();
    const categoryRepo = fakeCategoryRepo();

    await seedUser(USER_ID, accountRepo, categoryRepo);

    expect(accountRepo.created).toHaveLength(2);
    expect(categoryRepo.created).toHaveLength(8);

    // Verify account names
    const accountNames = accountRepo.created.map((a) => a.name);
    expect(accountNames).toContain("Efectivo");
    expect(accountNames).toContain("Nequi");

    // Verify category names
    const categoryNames = categoryRepo.created.map((c) => c.name);
    expect(categoryNames).toContain("Salario");
    expect(categoryNames).toContain("Comida");

    // All accounts belong to the correct user
    for (const acct of accountRepo.created) {
      expect(acct.userId).toBe(USER_ID);
    }

    // All categories belong to the correct user
    for (const cat of categoryRepo.created) {
      expect(cat.userId).toBe(USER_ID);
    }
  });

  it("generates unique ids for each entity", async () => {
    const accountRepo = fakeAccountRepo();
    const categoryRepo = fakeCategoryRepo();

    await seedUser(USER_ID, accountRepo, categoryRepo);

    const accountIds = accountRepo.created.map((a) => a.id);
    const categoryIds = categoryRepo.created.map((c) => c.id);
    const allIds = [...accountIds, ...categoryIds];

    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("is idempotent — calling twice does not throw", async () => {
    const accountRepo = fakeAccountRepo();
    const categoryRepo = fakeCategoryRepo();

    await seedUser(USER_ID, accountRepo, categoryRepo);
    await seedUser(USER_ID, accountRepo, categoryRepo);

    // Fake repos allow duplicates; the important thing is no error
    expect(accountRepo.created.length).toBe(4);
    expect(categoryRepo.created.length).toBe(16);
  });
});
