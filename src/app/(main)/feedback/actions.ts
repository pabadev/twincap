'use server';

import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { connectDb } from '../../../infrastructure/db/connection';
import { MongoUserRepository } from '../../../infrastructure/repositories/user-repository';
import { sendFeedback } from '../../../infrastructure/feedback/feedback-alerter';
import { MongoFeedbackRepository } from '../../../infrastructure/repositories/feedback-repository';

const VALID_KINDS = ['comment', 'bug', 'suggestion'] as const;
type FeedbackKind = (typeof VALID_KINDS)[number];

export async function submitFeedbackAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const authUser = await getCurrentUser();
  if (!authUser) return { error: 'error.unauthorized' };

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

    const args = {
      kind: kind as FeedbackKind,
      message,
      userId: authUser.userId,
      email: authUser.email ?? '',
      locale,
      page,
    };
    const dispatch = await sendFeedback(args);

    if (dispatch.delivered) {
      // Real delivery → persist the honest outcome and report success.
      await new MongoFeedbackRepository().record({
        ...args,
        email: args.email || undefined,
        result: 'delivered',
        attemptedAt: new Date(),
      });
      return { success: 'feedbackSent' };
    }

    if (dispatch.reason === 'not_configured' && process.env.NODE_ENV !== 'production') {
      // Dev gate: no provider configured on a dev install → silent success,
      // NOT persisted (dev installs are never spammed and never show a fake
      // error). In production this branch is skipped and the failure is real.
      return { success: 'feedbackSent' };
    }

    // Honest-result fix (R14-L §11): a failed send NEVER reports success.
    await new MongoFeedbackRepository().record({
      ...args,
      email: args.email || undefined,
      result: 'failed',
      attemptedAt: new Date(),
    });
    return { error: 'error.operationFailed' };
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error;
    return { error: 'error.operationFailed' };
  }

  return { success: 'feedbackSent' };
}
