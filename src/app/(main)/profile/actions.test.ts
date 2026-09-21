import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProfileAction } from "./actions";
import { MongoUserRepository } from "../../../infrastructure/repositories/user-repository";
import { User } from "../../../core/domain/user";
import type { Currency } from "../../../core/domain/currency";

vi.mock("../../../infrastructure/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({ userId: "user-123", workspaceId: "ws-1" })),
}));

vi.mock("../../../infrastructure/db/connection", () => ({
  connectDb: vi.fn(() => Promise.resolve()),
}));

describe("updateProfileAction - defaultCurrency", () => {
  let mockUserRepo: {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRepo = {
      findById: vi.fn(),
      update: vi.fn(),
    };
    vi.spyOn(MongoUserRepository.prototype, "findById").mockImplementation(mockUserRepo.findById);
    vi.spyOn(MongoUserRepository.prototype, "update").mockImplementation(mockUserRepo.update);
  });

  it("accepts valid currency code USD", async () => {
    const existingUser = new User({
      id: "user-123",
      email: "test@example.com",
      passwordHash: "hash",
      createdAt: new Date(),
      name: "Test User",
    });
    mockUserRepo.findById.mockResolvedValue(existingUser);
    mockUserRepo.update.mockResolvedValue(existingUser);

    const formData = new FormData();
    formData.append("defaultCurrency", "USD");

    const result = await updateProfileAction(null, formData);

    expect(result.success).toBe("profileSaved");
    expect(mockUserRepo.update).toHaveBeenCalled();
    const updatedUser = mockUserRepo.update.mock.calls[0][0] as User;
    expect(updatedUser.defaultCurrency).toBe("USD");
  });

  it("accepts valid currency code BRL (supported for PT-BR)", async () => {
    const existingUser = new User({
      id: "user-123",
      email: "test@example.com",
      passwordHash: "hash",
      createdAt: new Date(),
    });
    mockUserRepo.findById.mockResolvedValue(existingUser);

    const formData = new FormData();
    formData.append("defaultCurrency", "BRL");

    const result = await updateProfileAction(null, formData);

    expect(result.success).toBe("profileSaved");
    expect(mockUserRepo.update).toHaveBeenCalled();
    const updatedUser = mockUserRepo.update.mock.calls[0][0] as User;
    expect(updatedUser.defaultCurrency).toBe("BRL");
  });

  it("rejects invalid currency code", async () => {
    const existingUser = new User({
      id: "user-123",
      email: "test@example.com",
      passwordHash: "hash",
      createdAt: new Date(),
    });
    mockUserRepo.findById.mockResolvedValue(existingUser);

    const formData = new FormData();
    formData.append("defaultCurrency", "INVALID");

    const result = await updateProfileAction(null, formData);

    expect(result.error).toBe("error.invalidCurrency");
    expect(mockUserRepo.update).not.toHaveBeenCalled();
  });

  it("accepts empty defaultCurrency (clears the preference)", async () => {
    const existingUser = new User({
      id: "user-123",
      email: "test@example.com",
      passwordHash: "hash",
      createdAt: new Date(),
      defaultCurrency: "USD" as Currency,
    });
    mockUserRepo.findById.mockResolvedValue(existingUser);
    mockUserRepo.update.mockResolvedValue(existingUser);

    const formData = new FormData();
    formData.append("defaultCurrency", "");

    const result = await updateProfileAction(null, formData);

    expect(result.success).toBe("profileSaved");
    const updatedUser = mockUserRepo.update.mock.calls[0][0] as User;
    expect(updatedUser.defaultCurrency).toBeUndefined();
  });

  it("preserves existing defaultCurrency when not provided", async () => {
    const existingUser = new User({
      id: "user-123",
      email: "test@example.com",
      passwordHash: "hash",
      createdAt: new Date(),
      defaultCurrency: "EUR" as Currency,
    });
    mockUserRepo.findById.mockResolvedValue(existingUser);
    mockUserRepo.update.mockResolvedValue(existingUser);

    const formData = new FormData();
    // No defaultCurrency field

    const result = await updateProfileAction(null, formData);

    expect(result.success).toBe("profileSaved");
    const updatedUser = mockUserRepo.update.mock.calls[0][0] as User;
    expect(updatedUser.defaultCurrency).toBe("EUR");
  });
});
