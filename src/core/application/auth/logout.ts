import { deleteSessionCookie } from '../../../infrastructure/auth/session-cookie';

export async function logout(): Promise<void> {
  await deleteSessionCookie();
}
