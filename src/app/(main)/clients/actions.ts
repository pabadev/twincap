'use server';

import { z } from 'zod';
import {
  createClient,
  updateClient,
  deleteClient,
} from '../../../core/application/clients';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoClientRepository } from '../../../infrastructure/repositories/client-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { handleActionError } from '../../../lib/handle-action-error';

const ids = { generate: () => crypto.randomUUID() };

const clientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  note: z.string().optional(),
});

export async function createClientAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const parsed = clientSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    note: formData.get('note'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await connectDb();
    const clientRepo = new MongoClientRepository();
    await createClient(user.userId, parsed.data, clientRepo, ids);
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'clientCreated' };
}

export async function updateClientAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const clientId = formData.get('clientId') as string;
  if (!clientId) return { error: 'Client ID is required' };

  const parsed = clientSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    note: formData.get('note'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await connectDb();
    const clientRepo = new MongoClientRepository();
    await updateClient(user.userId, clientId, parsed.data, clientRepo);
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'clientUpdated' };
}

export async function deleteClientAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const clientId = formData.get('clientId') as string;

  try {
    await connectDb();
    const clientRepo = new MongoClientRepository();
    await deleteClient(user.userId, clientId, clientRepo);
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'clientDeleted' };
}
