'use server';

import { redirect } from 'next/navigation';
import { register } from '../../core/application/auth/register';
import { login } from '../../core/application/auth/login';
import { logout } from '../../core/application/auth/logout';
import { requestPasswordReset } from '../../core/application/auth/request-password-reset';
import { resetPassword } from '../../core/application/auth/reset-password';
import { verifyEmail } from '../../core/application/auth/verify-email';
import { bcryptPasswordHasher } from '../../infrastructure/auth/password';
import { joseSessionManager } from '../../infrastructure/auth/session';
import { setSessionCookie } from '../../infrastructure/auth/session-cookie';
import { MongoUserRepository } from '../../infrastructure/repositories/user-repository';
import { MongoAccountRepository } from '../../infrastructure/repositories/account-repository';
import { MongoCategoryRepository } from '../../infrastructure/repositories/category-repository';
import { MongoWorkspaceRepository } from '../../infrastructure/repositories/workspace-repository';
import { MongoMembershipRepository } from '../../infrastructure/repositories/membership-repository';
import { connectDb } from '../../infrastructure/db/connection';
import { objectIdGenerator } from '../../infrastructure/config/id-generator';
import {
  loginRateLimiter,
  registerRateLimiter,
  forgotPasswordRateLimiter,
} from '../../infrastructure/auth/rate-limiter';
import { MongoOperationLogger } from '../../infrastructure/repositories/operation-log-repository';
import { buildAuthEmailDeps } from '../../infrastructure/auth/auth-email-deps';
import { sendVerificationBestEffort } from '../../infrastructure/auth/send-verification-best-effort';
import { reportUnexpectedErrorAndWait } from '../../lib/report-unexpected-error';
import { trackAnalytics } from '../../lib/track-analytics';
import { ValidationError, ForbiddenError, NotFoundError } from '../../core/domain/errors';

const ids = objectIdGenerator;

function getRepos() {
  return {
    userRepo: new MongoUserRepository(),
    accountRepo: new MongoAccountRepository(),
    categoryRepo: new MongoCategoryRepository(),
    workspaceRepo: new MongoWorkspaceRepository(),
    membershipRepo: new MongoMembershipRepository(),
  };
}

/**
 * Reports an auth-flow error to the monitoring backend (R13-D), distinguishing
 * KNOWN/expected domain errors (validation/forbidden/not-found — never
 * alerted) from UNEXPECTED crashes (reported with expected:false). Non-blocking
 * and fail-safe; never changes the action's response contract.
 */
function reportAuthError(error: unknown): void {
  const expected = error instanceof ValidationError
    || error instanceof ForbiddenError
    || error instanceof NotFoundError;
  void reportUnexpectedErrorAndWait(error, { expected });
}

export async function registerAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  // Connect BEFORE the rate limiter (DB-backed) to avoid Mongoose buffering
  // timeouts on cold serverless starts. connectDb() is a cached no-op once up.
  await connectDb();

  // Rate limiting: 3 registrations per 15 min per IP
  const ip = formData.get('_ip') as string || 'unknown';
  const rateLimitKey = `register:${ip}`;
  const rateLimit = await registerRateLimiter.check(rateLimitKey);
  if (!rateLimit.allowed) {
    return { error: 'Too many registration attempts. Please try again later.' };
  }

  try {
    await connectDb();
    const { userRepo, accountRepo, categoryRepo, workspaceRepo, membershipRepo } = getRepos();
    const { userId, email: sessionEmail, workspaceId } = await register(
      { email, password },
      userRepo,
      accountRepo,
      categoryRepo,
      bcryptPasswordHasher,
      ids,
      workspaceRepo,
      membershipRepo,
    );
    await setSessionCookie(joseSessionManager, { sub: userId, email: sessionEmail, workspaceId });
    // R13-B2: fire the verification email best-effort (never blocks register).
    // New users have no locale yet; default to 'es' (primary market: LatAm).
    await sendVerificationBestEffort(
      { id: userId, email: sessionEmail, locale: 'es' },
      buildAuthEmailDeps(userRepo),
    );
    // Audit the successful registration (no actor exists before this point).
    await new MongoOperationLogger().log({
      userId,
      action: 'register',
      entityType: 'auth',
      result: 'success',
      occurredAt: new Date(),
    });
    // R13-G: track registration event (analytics, best-effort).
    await trackAnalytics('register', workspaceId, userId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
    reportAuthError(error);
    return { error: error instanceof Error ? error.message : 'Registration failed' };
  }

  redirect('/');
  return null;
}

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  // Connect BEFORE any model/repo use (the rate limiter hits the DB). In a
  // cold serverless start Mongoose buffers commands with no active connection
  // → "buffering timed out after 10000ms". connectDb() is a cached no-op once
  // connected, so this is cheap and idempotent.
  await connectDb();

  // Rate limiting: 5 attempts per 15 min per email+IP
  const ip = formData.get('_ip') as string || 'unknown';
  const rateLimitKey = `login:${email.toLowerCase().trim()}:${ip}`;
  const rateLimit = await loginRateLimiter.check(rateLimitKey);
  if (!rateLimit.allowed) {
    return { error: 'Too many login attempts. Please try again later.' };
  }

  try {
    await connectDb();
    const { userRepo, membershipRepo } = getRepos();
    const { userId, email: sessionEmail } = await login(
      { email, password },
      userRepo,
      bcryptPasswordHasher,
    );
    // Resolve workspaceId for the session
    const memberships = await membershipRepo.findByUserId(userId);
    const workspaceId = memberships.find((m) => m.status === 'active')?.workspaceId;
    // Reset rate limit on successful login
    await loginRateLimiter.reset(rateLimitKey);
    await setSessionCookie(joseSessionManager, { sub: userId, email: sessionEmail, workspaceId });
    // Audit the successful login (no actor is known before this point).
    await new MongoOperationLogger().log({
      userId,
      action: 'login',
      entityType: 'auth',
      result: 'success',
      occurredAt: new Date(),
    });
    // R13-G: track first login (deduplicated per workspace — only one doc ever).
    if (workspaceId) {
      await trackAnalytics('firstLogin', workspaceId, userId);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
    reportAuthError(error);
    return { error: error instanceof Error ? error.message : 'Login failed' };
  }

  redirect('/');
  return null;
}

export async function logoutAction() {
  await logout();
  redirect('/login');
}

export async function forgotPasswordAction(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = (formData.get('email') as string) || '';

  // Connect BEFORE the DB-backed rate limiter (avoids Mongoose buffering
  // timeouts in serverless cold starts). connectDb() is a cached no-op once up.
  await connectDb();

  // Rate limiting: 3 requests per 15 min per email+IP.
  const ip = (formData.get('_ip') as string) || 'unknown';
  const rateLimitKey = `forgot:${email.toLowerCase().trim()}:${ip}`;
  const rateLimit = await forgotPasswordRateLimiter.check(rateLimitKey);
  if (!rateLimit.allowed) {
    return { error: 'Auth.tooManyAttempts' };
  }

  try {
    await connectDb();
    const userRepo = new MongoUserRepository();
    // Anti-enumeration: returns ok even when the email is not registered.
    await requestPasswordReset({ email }, buildAuthEmailDeps(userRepo));
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
    reportAuthError(error);
    return { error: 'error.operationFailed' };
  }

  // Always show success (no account/email enumeration).
  return { success: true };
}

export async function resetPasswordAction(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = (formData.get('email') as string) || '';
  const token = (formData.get('token') as string) || '';
  const newPassword = (formData.get('newPassword') as string) || '';

  try {
    await connectDb();
    const userRepo = new MongoUserRepository();
    await resetPassword(
      { email, token, newPassword },
      buildAuthEmailDeps(userRepo),
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
    reportAuthError(error);
    return { error: 'Auth.invalidResetToken' };
  }

  return { success: true };
}

export async function verifyEmailAction(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = (formData.get('email') as string) || '';
  const token = (formData.get('token') as string) || '';

  try {
    await connectDb();
    const userRepo = new MongoUserRepository();
    await verifyEmail({ email, token }, buildAuthEmailDeps(userRepo));
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
    reportAuthError(error);
    return { error: 'Auth.invalidResetToken' };
  }

  return { success: true };
}
