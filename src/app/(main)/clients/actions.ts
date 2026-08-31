'use server';

import { z } from 'zod';
import {
  createClient,
  updateClient,
  deleteClient,
} from '../../../core/application/clients';
import type { SerializedClient } from '../../../core/domain/client';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoClientRepository } from '../../../infrastructure/repositories/client-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { objectIdGenerator } from '../../../infrastructure/config/id-generator';
import { revalidatePath } from 'next/cache';
import { handleActionError } from '../../../lib/handle-action-error';

const ids = objectIdGenerator;

const clientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  note: z.string().optional(),
});

export type ClientActionResult = {
  error?: string;
  success?: string;
  /** Snapshot of the created/updated client — lets flows like the sale form auto-select it. */
  client?: SerializedClient;
};

export async function createClientAction(
  _prev: ClientActionResult | null,
  formData: FormData,
): Promise<ClientActionResult> {
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
    const client = await createClient(user.userId, parsed.data, clientRepo, ids);
    revalidatePath('/clients');
    revalidatePath('/pos/sales');
    return { success: 'clientCreated', client: client.toJSON() };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateClientAction(
  _prev: ClientActionResult | null,
  formData: FormData,
): Promise<ClientActionResult> {
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
    const client = await updateClient(user.userId, clientId, parsed.data, clientRepo);
    revalidatePath('/clients');
    revalidatePath('/pos/sales');
    return { success: 'clientUpdated', client: client.toJSON() };
  } catch (error) {
    return handleActionError(error);
  }
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
    revalidatePath('/clients');
    revalidatePath('/pos/sales');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'clientDeleted' };
}
