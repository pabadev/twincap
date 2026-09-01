import { describe, it, expect, vi } from 'vitest';

// Mock mongoose fully (NO importOriginal) so the model file's module-level
// `mongoose.model('OperationLog', schema)` registers against a controlled stub.
const { modelCalls } = vi.hoisted(() => ({ modelCalls: [] as { name: string }[] }));
vi.mock('mongoose', () => {
  class FakeSchema {
    obj: Record<string, any>;
    options: Record<string, any>;
    constructor(fields: Record<string, any> = {}, options: Record<string, any> = {}) {
      this.obj = fields;
      this.options = options;
    }
    // Stub for OperationLogSchema.index(...)
    index(): void {
      /* noop */
    }
  }
  const models: Record<string, any> = {};
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
import { OperationLogModel, OperationLogSchema } from './operation-log';

describe('OperationLog mongoose model', () => {
  it('registers the model under the name "OperationLog"', () => {
    expect((mongoose as any).models.OperationLog).toBeDefined();
    expect(modelCalls).toEqual([{ name: 'OperationLog' }]);
    expect(OperationLogModel.name).toBe('OperationLog');
  });

  it('defines the minimal, PII-free fields with correct types and constraints', () => {
    const schemaFields = OperationLogSchema.obj as Record<string, any>;

    expect(schemaFields.userId).toMatchObject({ type: String, required: true });
    expect(schemaFields.action).toMatchObject({ type: String, required: true });
    expect(schemaFields.entityType).toMatchObject({ type: String, required: true });
    expect(schemaFields.entityId).toMatchObject({ type: String });
    expect(schemaFields.result).toMatchObject({
      type: String,
      required: true,
      enum: ['success', 'error', 'duplicate'],
    });
    expect(schemaFields.correlationId).toMatchObject({ type: String });
    expect(schemaFields.durationMs).toMatchObject({ type: Number });
    expect(schemaFields.errorCode).toMatchObject({ type: String });
    expect(schemaFields.occurredAt).toMatchObject({ type: Date, required: true });
  });

  it('does NOT define any PII field', () => {
    const fields = Object.keys(OperationLogSchema.obj);
    const piiLike = fields.filter((f) =>
      /email|name|token|passw|secret|payload|snapshot|oldData|newData|stack|amount|old|new/i.test(f),
    );
    expect(piiLike).toEqual([]);
  });

  it('restricts `result` to the success/error/duplicate enum', () => {
    const resultField = (OperationLogSchema.obj as Record<string, any>).result;
    expect(resultField.enum).toEqual(['success', 'error', 'duplicate']);
  });

  it('does not opt into automatic timestamps', () => {
    const options = OperationLogSchema.options as { timestamps?: unknown };
    // timestamps must not be enabled (no `true`).
    expect(options.timestamps).not.toBe(true);
  });
});
