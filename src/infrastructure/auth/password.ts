import bcrypt from "bcryptjs";
import type { PasswordHasher } from "../../core/application/ports";

const SALT_ROUNDS = 12;

export const bcryptPasswordHasher: PasswordHasher = {
  hash: (plain: string) => bcrypt.hash(plain, SALT_ROUNDS),
  compare: (plain: string, hashed: string) => bcrypt.compare(plain, hashed),
};
