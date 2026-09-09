import type { UserRepository, AccountRepository, CategoryRepository, WorkspaceRepository, MembershipRepository } from '../../domain/repositories';
import type { PasswordHasher, IdGenerator, WorkspaceBootstrapper, UnitOfWork } from '../ports';
import { User } from '../../domain/user';
import { Workspace } from '../../domain/workspace';
import { Membership } from '../../domain/membership';
import { ValidationError, ConflictError } from '../../domain/errors';

export interface RegisterInput {
  email: string;
  password: string;
}

export interface RegisterOutput {
  userId: string;
  /** Denormalized into the session token so layouts skip the DB roundtrip (P5). */
  email: string;
  /** The newly created personal workspace id. */
  workspaceId: string;
  /** Session invalidation version (R14-F §13) — minted into the JWT. */
  sessionVersion: number;
}

/**
 * Register a new user and atomically create their personal workspace, the
 * owner membership and the seed content (fixed account + categories).
 *
 * R15 Fase 6 (§12): User + Workspace + Membership + seed run inside
 * `uow.withTransaction(...)` — a failure in ANY step rolls back the whole
 * onboarding, so there are no partial users, no orphan workspaces/memberships
 * and no orphan seed accounts/categories. The `hasher.hash` and the duplicate
 * email pre-check stay OUTSIDE the transaction (validation precedes the tx).
 * Ids are minted INSIDE the callback so a driver retry never duplicates a user.
 */
export async function register(
  input: RegisterInput,
  userRepo: UserRepository,
  accountRepo: AccountRepository,
  categoryRepo: CategoryRepository,
  hasher: PasswordHasher,
  ids: IdGenerator,
  workspaceRepo: WorkspaceRepository,
  membershipRepo: MembershipRepository,
  bootstrapper: WorkspaceBootstrapper,
  uow: UnitOfWork,
): Promise<RegisterOutput> {
  // AUTH-1: normalized email, min 8 chars password
  const normalizedEmail = input.email.trim().toLowerCase();
  if (input.password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  // AUTH-1: duplicate email reject (pre-check OUTSIDE the transaction)
  const existing = await userRepo.findByEmail(normalizedEmail);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  // Password hashing stays outside the tx (CPU-bound, no DB involvement).
  const passwordHash = await hasher.hash(input.password);

  return uow.withTransaction(async (tx) => {
    // Create user — Mongoose auto-generates _id
    const user = new User({
      id: ids.generate(),
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date(),
    });
    const createdUser = await userRepo.create(user, tx);

    // Create personal workspace + owner membership
    const workspace = new Workspace({
      id: ids.generate(),
      ownerId: createdUser.id,
      name: 'Mi espacio',
      createdAt: new Date(),
    });
    const createdWorkspace = await workspaceRepo.create(workspace, tx);

    const membership = new Membership({
      id: ids.generate(),
      userId: createdUser.id,
      workspaceId: createdWorkspace.id,
      role: 'owner',
      createdAt: new Date(),
    });
    await membershipRepo.create(membership, tx);

    // AUTH-4: seed accounts + categories into the workspace (inside the tx).
    await bootstrapper.bootstrap(createdWorkspace.id, tx);

    return {
      userId: createdUser.id,
      email: createdUser.email,
      workspaceId: createdWorkspace.id,
      sessionVersion: createdUser.sessionVersion ?? 0,
    };
  });
}
