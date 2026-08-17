'use server';

import { redirect } from 'next/navigation';
import { register } from '../../core/application/auth/register';
import { login } from '../../core/application/auth/login';
import { logout } from '../../core/application/auth/logout';
import { bcryptPasswordHasher } from '../../infrastructure/auth/password';
import { joseSessionManager } from '../../infrastructure/auth/session';
import { setSessionCookie } from '../../infrastructure/auth/session-cookie';
import { MongoUserRepository } from '../../infrastructure/repositories/user-repository';
import { MongoAccountRepository } from '../../infrastructure/repositories/account-repository';
import { MongoCategoryRepository } from '../../infrastructure/repositories/category-repository';

const userRepo = new MongoUserRepository();
const accountRepo = new MongoAccountRepository();
const categoryRepo = new MongoCategoryRepository();
const ids = { generate: () => crypto.randomUUID() };

export async function registerAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const { userId } = await register(
      { email, password },
      userRepo,
      accountRepo,
      categoryRepo,
      bcryptPasswordHasher,
      joseSessionManager,
      ids,
    );
    await setSessionCookie(joseSessionManager, userId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
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

  try {
    const { userId } = await login(
      { email, password },
      userRepo,
      bcryptPasswordHasher,
    );
    await setSessionCookie(joseSessionManager, userId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
    return { error: error instanceof Error ? error.message : 'Login failed' };
  }

  redirect('/');
  return null;
}

export async function logoutAction() {
  await logout();
  redirect('/login');
}
