import { describe, it, expect, vi } from 'vitest';

// Mock mongoose fully (NO importOriginal) so the model file's module-level
// `mongoose.model('Feedback', schema)` registers against a controlled stub.
const { modelCalls, indexCalls } = vi.hoisted(() => ({
  modelCalls: [] as { name: string }[],
  indexCalls: [] as unknown[],
}));
vi.mock('mongoose', () => {
  class FakeSchema {
    obj: Record<string, unknown>;
    options: Record<string, unknown>;
    constructor(fields: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
      this.obj = fields;
      this.options = options;
    }
    // Stub for FeedbackSchema.index(...)
    index(...args: unknown[]): void {
      indexCalls.push(args);
    }
  }
  const models: Record<string, unknown> = {};
  const register = (name: string, schema: unknown) => {
    modelCalls.push({ name });
    models[name] = { name, schema };
    return models[name];
  };
  return {
    default: { Schema: FakeSchema, models, model: register },
    Schema: FakeSchema,
    model: register,
    models,
  };
});

import mongoose from 'mongoose';
import { FeedbackModel, FeedbackSchema } from './feedback';

describe('Feedback mongoose model', () => {
  it('registers the model under the name "Feedback"', () => {
    expect((mongoose as { models: Record<string, unknown> }).models.Feedback).toBeDefined();
    expect(modelCalls).toEqual([{ name: 'Feedback' }]);
    expect(FeedbackModel.name).toBe('Feedback');
  });

  it('defines the support record fields with correct types and constraints', () => {
    const schemaFields = FeedbackSchema.obj as Record<string, Record<string, unknown>>;

    expect(schemaFields.kind).toMatchObject({
      type: String,
      required: true,
      enum: ['comment', 'bug', 'suggestion'],
    });
    expect(schemaFields.message).toMatchObject({ type: String, required: true });
    expect(schemaFields.userId).toMatchObject({ type: String, required: true });
    expect(schemaFields.email).toMatchObject({ type: String });
    expect(schemaFields.locale).toMatchObject({ type: String, required: true });
    expect(schemaFields.page).toMatchObject({ type: String });
    expect(schemaFields.result).toMatchObject({
      type: String,
      required: true,
      enum: ['delivered', 'failed'],
    });
    expect(schemaFields.attemptedAt).toMatchObject({ type: Date, required: true });
  });

  it('restricts `kind` to the comment/bug/suggestion enum', () => {
    const kindField = (FeedbackSchema.obj as Record<string, Record<string, unknown>>).kind;
    expect(kindField.enum).toEqual(['comment', 'bug', 'suggestion']);
  });

  it('restricts `result` to the delivered/failed enum', () => {
    const resultField = (FeedbackSchema.obj as Record<string, Record<string, unknown>>).result;
    expect(resultField.enum).toEqual(['delivered', 'failed']);
  });

  it('adds the composite triage index over userId + attemptedAt', () => {
    expect(indexCalls).toContainEqual([{ userId: 1, attemptedAt: -1 }]);
  });

  it('does not opt into automatic timestamps', () => {
    const options = FeedbackSchema.options as { timestamps?: unknown };
    // timestamps must not be enabled (no `true`).
    expect(options.timestamps).not.toBe(true);
  });
});