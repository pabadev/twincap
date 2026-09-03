'use server';

import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { connectDb } from '../../../infrastructure/db/connection';
import { MongoUserRepository } from '../../../infrastructure/repositories/user-repository';
import { sendFeedback } from '../../../infrastructure/feedback/feedback-alerter';

const VALID_KINDS = ['comment', 'bug', 'suggestion'] as const;
type FeedbackKind = (typeof VALID_KINDS)[number];

export async function submitFeedbackAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const authUser = await getCurrentUser();
  if (!authUser) return { error: 'Unauthorized' };

  const kind = (formData.get('kind') as string) ?? '';
  const message = ((formData.get('message') as string) ?? '').trim();
  const page = (formData.get('page') as string) ?? '';

  if (!VALID_KINDS.includes(kind as FeedbackKind)) {
    return { error: 'error.validation' };
  }
  if (!message || message.length > 2000) {
    return { error: 'error.validation' };
  }

  try {
    // Fetch user locale from DB for accuracy (best-effort; fall back to 'es').
    await connectDb();
    const userRepo = new MongoUserRepository();
    const user = await userRepo.findById(authUser.userId);
    const locale = user?.locale ?? 'es';

    await sendFeedback({
      kind: kind as FeedbackKind,
      message,
      userId: authUser.userId,
      email: authUser.email ?? '',
      locale,
      page,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
    return { error: 'error.operationFailed' };
  }

  return { success: 'feedbackSent' };
}
