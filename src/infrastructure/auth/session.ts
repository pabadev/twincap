import { EncryptJWT, jwtDecrypt, base64url } from "jose";
import type { SessionManager } from "../../core/application/ports";
import { env } from "../config/env";

// AUTH_SECRET is a base64url-encoded 32-byte key for A256GCM.
const secret = base64url.decode(env.AUTH_SECRET);
const HEADER = { alg: "dir", enc: "A256GCM" } as const;

export const joseSessionManager: SessionManager = {
  create: async (claims) => {
    return new EncryptJWT({ sub: claims.sub, email: claims.email })
      .setProtectedHeader(HEADER)
      .setIssuedAt()
      .setExpirationTime("30d")
      .encrypt(secret);
  },
  verify: async (token) => {
    try {
      const { payload } = await jwtDecrypt(token, secret);
      return {
        sub: payload.sub as string,
        email: typeof payload.email === "string" ? payload.email : undefined,
      };
    } catch {
      return null;
    }
  },
};
