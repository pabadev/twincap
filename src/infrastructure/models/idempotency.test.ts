import { describe, it, expect, vi } from 'vitest';

// Mock mongoose fully (NO importOriginal) so the model file's module-level
// `mongoose.model('Idempotency', schema)` registers against a controlled stub.
// The FakeSchema records `.index()` calls so the structural guarantees of
// R15.3 §19/§20 can be asserted (unique + TTL).
const { indexCalls } = vi.hoisted(() => ({
  indexCalls: [] as { index: unknown; options: unknown }[],
}));
vi.mock('mongoose', () => {
  class FakeSchema {
    obj: Record<string, unknown>;
    options: Record<string, unknown>;
    constructor(fields: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
      this.obj = fields;
      this.options = options;
    }
    index(index: unknown, options: unknown): void {
      indexCalls.push({ index: JSON.parse(JSON.stringify(index)), options: JSON.parse(JSON.stringify(options)) });
    }
  }
  const models: Record<string, unknown> = {};
  const register = (name: string, schema: unknown) => {
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
import { IdempotencyModel, IdempotencySchema } from './idempotency';

describe('Idempotency mongoose model', () => {
  it('registers the model under the name "Idempotency"', () => {
    expect((mongoose as { models: Record<string, unknown> }).models.Idempotency).toBeDefined();
    expect(IdempotencyModel.name).toBe('Idempotency');
  });

  it('defines the dedupe fields (userId+action+key) and createdAt', () => {
    const schemaFields = IdempotencySchema.obj as Record<string, Record<string, unknown>>;

    expect(schemaFields.userId).toEqual({ type: String, required: true });
    expect(schemaFields.key).toEqual({ type: String, required: true });
    expect(schemaFields.action).toEqual({ type: String, required: true });
    expect(schemaFields.createdAt).toEqual({
      type: Date,
      required: true,
      default: expect.any(Function),
    });
  });

  it('R15.3 §19 — has a UNIQUE index on (userId, action, key)', () => {
    expect(indexCalls).toContainEqual({
      index: { userId: 1, action: 1, key: 1 },
      options: { unique: true },
    });
  });

  it('R15.3 §20 — scopes dedupe by userId (1 user = 1 workspace guarantee), not workspaceId', () => {
    // Structural contract that the workspace migration must respect: the
    // unique scope is per USER. If the product ever ships N workspaces per
    // user, this index MUST move to workspaceId first (see model JSDoc).
    const indexes = indexCalls.map((c) => JSON.stringify(c));
    expect(indexes.some((i) => i.includes('userId'))).toBe(true);
    expect(indexes.some((i) => i.includes('workspaceId'))).toBe(false);
  });

  it('expires records via a TTL index on createdAt (24h)', () => {
    expect(indexCalls).toContainEqual({
      index: { createdAt: 1 },
      options: { expireAfterSeconds: 24 * 60 * 60 },
    });
  });
});