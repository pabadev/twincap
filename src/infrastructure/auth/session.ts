import { EncryptJWT, jwtDecrypt } from "jose";
import type { SessionManager } from "../../core/application/ports";
import { env } from "../config/env";

const secret = new TextEncoder().encode(env.AUTH_SECRET);
const HEADER = { alg: "dir", enc: "A256GCM" } as const;

export const joseSessionManager: SessionManager = {
  create: async (userId: string) => {
    return new EncryptJWT({ sub: userId })
      .setProtectedHeader(HEADER)
      .setIssuedAt()
      .setExpirationTime("30d")
      .encrypt(secret);
  },
  verify: async (token: string) => {
    try {
      const { payload } = await jwtDecrypt(token, secret);
      return { sub: payload.sub as string };
    } catch {
      return null;
    }
  },
};
