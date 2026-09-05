import { describe, expect, it, vi } from 'vitest';
import {
  parseExcludedEmails,
  resolveExcludedWorkspaceIds,
  type ExclusionDeps,
} from './analytics-exclusion';

describe('parseExcludedEmails (ANALYTICS_EXCLUDE_EMAILS)', () => {
  it('returns [] when the env is undefined (no exclusion by default)', () => {
    expect(parseExcludedEmails(undefined)).toEqual([]);
  });

  it('returns [] when the env is empty or only separators/whitespace', () => {
    expect(parseExcludedEmails('')).toEqual([]);
    expect(parseExcludedEmails('   ,  ,  ')).toEqual([]);
  });

  it('parses a single email (trimmed, lowercased)', () => {
    expect(parseExcludedEmails('  Founder@Example.com ')).toEqual([
      'founder@example.com',
    ]);
  });

  it('parses comma-separated emails with whitespace and mixed case', () => {
    expect(parseExcludedEmails(' A@X.com , b@y.com,  C@Z.com  ')).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
    ]);
  });

  it('drops empty entries between commas', () => {
    expect(parseExcludedEmails('a@x.com,,, b@y.com ,,')).toEqual([
      'a@x.com',
      'b@y.com',
    ]);
  });

  it('dedupes preserving first-occurrence order', () => {
    expect(parseExcludedEmails('a@x.com,b@y.com,A@X.COM,b@y.com')).toEqual([
      'a@x.com',
      'b@y.com',
    ]);
  });
});

describe('resolveExcludedWorkspaceIds', () => {
  function makeDeps(
    findByEmail: ExclusionDeps['findByEmail'],
    findWorkspaceIdsByUser: ExclusionDeps['findWorkspaceIdsByUser'],
  ): ExclusionDeps {
    return { findByEmail, findWorkspaceIdsByUser };
  }

  it('resolves emails → users → workspaceIds', async () => {
    const findByEmail = vi.fn(async (email: string) =>
      email === 'founder@example.com' ? { id: 'user-1' } : null,
    );
    const findWorkspaceIdsByUser = vi.fn(async (userId: string) =>
      userId === 'user-1' ? ['ws-1', 'ws-2'] : [],
    );

    const result = await resolveExcludedWorkspaceIds(
      ['founder@example.com'],
      makeDeps(findByEmail, findWorkspaceIdsByUser),
    );

    expect(result).toEqual(['ws-1', 'ws-2']);
    expect(findByEmail).toHaveBeenCalledExactlyOnceWith('founder@example.com');
    expect(findWorkspaceIdsByUser).toHaveBeenCalledExactlyOnceWith('user-1');
  });

  it('skips emails whose user is not found (no workspace lookup)', async () => {
    const findByEmail = vi.fn(async () => null);
    const findWorkspaceIdsByUser = vi.fn(async () => ['ws-1']);

    const result = await resolveExcludedWorkspaceIds(
      ['ghost@example.com'],
      makeDeps(findByEmail, findWorkspaceIdsByUser),
    );

    expect(result).toEqual([]);
    expect(findWorkspaceIdsByUser).not.toHaveBeenCalled();
  });

  it('collects workspaces across multiple users', async () => {
    const usersById: Record<string, string[]> = {
      'user-1': ['ws-a'],
      'user-2': ['ws-b', 'ws-c'],
    };
    const findByEmail = vi.fn(async (email: string) => {
      const id = email === 'a@x.com' ? 'user-1' : email === 'b@x.com' ? 'user-2' : null;
      return id ? { id } : null;
    });
    const findWorkspaceIdsByUser = vi.fn(async (userId: string) => usersById[userId] ?? []);

    const result = await resolveExcludedWorkspaceIds(
      ['a@x.com', 'b@x.com', 'unknown@x.com'],
      makeDeps(findByEmail, findWorkspaceIdsByUser),
    );

    expect(result).toEqual(['ws-a', 'ws-b', 'ws-c']);
    expect(findWorkspaceIdsByUser).toHaveBeenCalledTimes(2);
  });

  it('dedupes workspace ids shared across users/emails', async () => {
    const findByEmail = vi.fn(async (email: string) => ({ id: `user-${email}` }));
    const findWorkspaceIdsByUser = vi.fn(async (userId: string) =>
      userId === 'user-a@x.com' ? ['ws-shared', 'ws-a'] : ['ws-shared', 'ws-b'],
    );

    const result = await resolveExcludedWorkspaceIds(
      ['a@x.com', 'b@x.com'],
      makeDeps(findByEmail, findWorkspaceIdsByUser),
    );

    // 'ws-shared' belongs to BOTH excluded users — must appear once.
    expect(result).toEqual(['ws-shared', 'ws-a', 'ws-b']);
  });

  it('returns [] when there are no excluded emails (deps never called)', async () => {
    const findByEmail = vi.fn();
    const findWorkspaceIdsByUser = vi.fn();

    const result = await resolveExcludedWorkspaceIds(
      [],
      makeDeps(findByEmail, findWorkspaceIdsByUser),
    );

    expect(result).toEqual([]);
    expect(findByEmail).not.toHaveBeenCalled();
    expect(findWorkspaceIdsByUser).not.toHaveBeenCalled();
  });
});