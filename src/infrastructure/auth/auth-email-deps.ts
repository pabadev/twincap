import type { AuthEmailDeps } from '../../core/application/auth/email-deps';
import { getEnv } from '../config/env';
import { objectIdGenerator } from '../config/id-generator';
import { bcryptPasswordHasher } from './password';
import { generateAuthToken } from './token-generator';
import { ResendEmailSender } from '../email/resend-email-sender';
import { MongoAuthTokenRepository } from '../repositories/auth-token-repository';
import { systemClock } from './system-clock';

/**
 * Builds the real AuthEmailDeps for the R13-B auth email flows (password
 * reset + email verification). Callers pass a live user repo. Rate limiting
 * is owned by the server action, not here.
 */
export function buildAuthEmailDeps(userRepo: AuthEmailDeps['userRepo']): AuthEmailDeps {
  const env = getEnv();
  return {
    userRepo,
    tokenStore: new MongoAuthTokenRepository(),
    hasher: bcryptPasswordHasher,
    ids: objectIdGenerator,
    clock: systemClock,
    emailSender: new ResendEmailSender(),
    generateToken: generateAuthToken,
    baseUrl: env.APP_BASE_URL ?? 'http://localhost:3000',
  };
}
