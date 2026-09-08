import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, the mongo user repository, the feedback
// dispatcher and the feedback record repository.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { MongoUserRepository } = vi.hoisted(() => ({ MongoUserRepository: vi.fn() }));
const { sendFeedback } = vi.hoisted(() => ({ sendFeedback: vi.fn() }));
const { MongoFeedbackRepository } = vi.hoisted(() => ({ MongoFeedbackRepository: vi.fn() }));

vi.mock('../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('../../../infrastructure/repositories/user-repository', () => ({ MongoUserRepository }));
vi.mock('../../../infrastructure/feedback/feedback-alerter', () => ({ sendFeedback }));
vi.mock('../../../infrastructure/repositories/feedback-repository', () => ({
  MongoFeedbackRepository,
}));

const { submitFeedbackAction } = await import('./actions');

function makeFormData(kind: string, message: string, page = ''): FormData {
  const fd = new FormData();
  fd.append('kind', kind);
  fd.append('message', message);
  if (page) fd.append('page', page);
  return fd;
}

/** Authenticated user + resolvable DB user without touching the dispatcher. */
function setUpUser() {
  getCurrentUser.mockResolvedValue({
    userId: 'user-1',
    workspaceId: 'user-1',
    email: 'user@example.com',
  });
  connectDb.mockResolvedValue(undefined);
  MongoUserRepository.mockImplementation(() => ({
    findById: vi.fn().mockResolvedValue({ locale: 'es' }),
  }));
}

/** Mock the feedback repository constructor; returns the injected record fn. */
function setUpRecordMock(): { record: ReturnType<typeof vi.fn> } {
  const record = vi.fn().mockResolvedValue(undefined);
  MongoFeedbackRepository.mockImplementation(() => ({ record }));
  return { record };
}

describe('submitFeedbackAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(null);
  });

  afterEach(() => {
    // Restore NODE_ENV to its real value.
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await submitFeedbackAction(null, makeFormData('comment', 'hello'));

    expect(result).toEqual({ error: 'error.unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoUserRepository).not.toHaveBeenCalled();
    expect(MongoFeedbackRepository).not.toHaveBeenCalled();
  });

  describe('validation', () => {
    it('rejects an invalid kind with error.validation', async () => {
      getCurrentUser.mockResolvedValue({ userId: 'user-1' });

      const result = await submitFeedbackAction(null, makeFormData('spam', 'hello'));

      expect(result).toEqual({ error: 'error.validation' });
      expect(connectDb).not.toHaveBeenCalled();
      expect(sendFeedback).not.toHaveBeenCalled();
    });

    it('rejects an empty message with error.validation', async () => {
      getCurrentUser.mockResolvedValue({ userId: 'user-1' });

      const result = await submitFeedbackAction(null, makeFormData('comment', '   '));

      expect(result).toEqual({ error: 'error.validation' });
      expect(connectDb).not.toHaveBeenCalled();
      expect(sendFeedback).not.toHaveBeenCalled();
    });

    it('rejects a message over 2000 chars with error.validation', async () => {
      getCurrentUser.mockResolvedValue({ userId: 'user-1' });

      const result = await submitFeedbackAction(null, makeFormData('comment', 'x'.repeat(2001)));

      expect(result).toEqual({ error: 'error.validation' });
      expect(connectDb).not.toHaveBeenCalled();
      expect(sendFeedback).not.toHaveBeenCalled();
    });
  });

  it('reports success and persists a delivered record when the email was really sent', async () => {
    setUpUser();
    const { record } = setUpRecordMock();
    sendFeedback.mockResolvedValue({ delivered: true });

    const result = await submitFeedbackAction(
      null,
      makeFormData('bug', 'Dashboard crashes', '/dashboard'),
    );

    expect(result).toEqual({ success: 'feedbackSent' });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'bug',
        message: 'Dashboard crashes',
        userId: 'user-1',
        email: 'user@example.com',
        locale: 'es',
        page: '/dashboard',
        result: 'delivered',
        attemptedAt: expect.any(Date),
      }),
    );
  });

  it('never reports success when the transport fails — persists a failed record and returns an error (R14-L §11 regression)', async () => {
    setUpUser();
    const { record } = setUpRecordMock();
    sendFeedback.mockResolvedValue({ delivered: false, reason: 'transport_error' });

    const result = await submitFeedbackAction(null, makeFormData('comment', 'hello'));

    expect(result).toEqual({ error: 'error.operationFailed' });
    expect(result.success).toBeUndefined();
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'comment',
        locale: 'es',
        result: 'failed',
        attemptedAt: expect.any(Date),
      }),
    );
  });

  it('keeps the dev gate: not_configured outside production reports success WITHOUT persisting', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    setUpUser();
    const { record } = setUpRecordMock();
    sendFeedback.mockResolvedValue({ delivered: false, reason: 'not_configured' });

    const result = await submitFeedbackAction(null, makeFormData('suggestion', 'Add dark mode'));

    expect(result).toEqual({ success: 'feedbackSent' });
    expect(record).not.toHaveBeenCalled();
  });

  it('treats not_configured as a REAL failure in production — persists failed and returns an error', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    setUpUser();
    const { record } = setUpRecordMock();
    sendFeedback.mockResolvedValue({ delivered: false, reason: 'not_configured' });

    const result = await submitFeedbackAction(null, makeFormData('comment', 'hello'));

    expect(result).toEqual({ error: 'error.operationFailed' });
    expect(result.success).toBeUndefined();
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'comment',
        locale: 'es',
        result: 'failed',
        attemptedAt: expect.any(Date),
      }),
    );
  });
});