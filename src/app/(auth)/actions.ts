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
import { connectDb } from '../../infrastructure/db/connection';

const ids = { generate: () => crypto.randomUUID() };

function getRepos() {
  return {
    userRepo: new MongoUserRepository(),
    accountRepo: new MongoAccountRepository(),
    categoryRepo: new MongoCategoryRepository(),
  };
}

export async function registerAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    await connectDb();
    const { userRepo, accountRepo, categoryRepo } = getRepos();
    const { userId, email: sessionEmail } = await register(
      { email, password },
      userRepo,
      accountRepo,
      categoryRepo,
      bcryptPasswordHasher,
      ids,
    );
    await setSessionCookie(joseSessionManager, { sub: userId, email: sessionEmail });
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
    await connectDb();
    const { userRepo } = getRepos();
    const { userId, email: sessionEmail } = await login(
      { email, password },
      userRepo,
      bcryptPasswordHasher,
    );
    await setSessionCookie(joseSessionManager, { sub: userId, email: sessionEmail });
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
