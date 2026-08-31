'use server';

import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { connectDb } from '../../../infrastructure/db/connection';
import { MongoUserRepository } from '../../../infrastructure/repositories/user-repository';
import { bcryptPasswordHasher } from '../../../infrastructure/auth/password';
import { User } from '../../../core/domain/user';
import { passwordChangeRateLimiter } from '../../../infrastructure/auth/rate-limiter';

export async function updateProfileAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const authUser = await getCurrentUser();
  if (!authUser) return { error: 'Unauthorized' };

  const name = (formData.get('name') as string) || undefined;
  const locale = (formData.get('locale') as string) || undefined;

  try {
    await connectDb();
    const userRepo = new MongoUserRepository();
    const existing = await userRepo.findById(authUser.userId);
    if (!existing) return { error: 'error.notFound' };

    const updated = new User({
      id: existing.id,
      email: existing.email,
      passwordHash: existing.passwordHash,
      createdAt: existing.createdAt,
      name: name ?? existing.name,
      locale: locale ?? existing.locale,
    });

    await userRepo.update(updated);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
    return { error: 'error.operationFailed' };
  }

  return { success: 'profileSaved' };
}

export async function changePasswordAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const authUser = await getCurrentUser();
  if (!authUser) return { error: 'Unauthorized' };

  // Rate limiting: 5 attempts per 15 min per user
  const rateLimitKey = `password:${authUser.userId}`;
  const rateLimit = await passwordChangeRateLimiter.check(rateLimitKey);
  if (!rateLimit.allowed) {
    return { error: 'Too many password change attempts. Please try again later.' };
  }

  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'error.validation' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'passwordMismatch' };
  }

  try {
    await connectDb();
    const userRepo = new MongoUserRepository();
    const existing = await userRepo.findById(authUser.userId);
    if (!existing) return { error: 'error.notFound' };

    const valid = await bcryptPasswordHasher.compare(currentPassword, existing.passwordHash);
    if (!valid) {
      return { error: 'wrongPassword' };
    }

    const newHash = await bcryptPasswordHasher.hash(newPassword);
    const updated = new User({
      id: existing.id,
      email: existing.email,
      passwordHash: newHash,
      createdAt: existing.createdAt,
      name: existing.name,
      locale: existing.locale,
    });

    await userRepo.update(updated);
    // Reset rate limit on successful password change
    await passwordChangeRateLimiter.reset(rateLimitKey);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
    return { error: 'error.operationFailed' };
  }

  return { success: 'passwordChanged' };
}
