import type { UserRepository, AccountRepository, CategoryRepository, WorkspaceRepository, MembershipRepository } from '../../domain/repositories';
import type { PasswordHasher, IdGenerator } from '../ports';
import { User } from '../../domain/user';
import { Workspace } from '../../domain/workspace';
import { Membership } from '../../domain/membership';
import { ValidationError, ConflictError } from '../../domain/errors';
import { seedUser } from '../../../infrastructure/seeding/user-bootstrap';

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
}

export async function register(
  input: RegisterInput,
  userRepo: UserRepository,
  accountRepo: AccountRepository,
  categoryRepo: CategoryRepository,
  hasher: PasswordHasher,
  ids: IdGenerator,
  workspaceRepo: WorkspaceRepository,
  membershipRepo: MembershipRepository,
): Promise<RegisterOutput> {
  // AUTH-1: normalized email, min 8 chars password
  const normalizedEmail = input.email.trim().toLowerCase();
  if (input.password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  // AUTH-1: duplicate email reject
  const existing = await userRepo.findByEmail(normalizedEmail);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  // Create user — Mongoose auto-generates _id
  const passwordHash = await hasher.hash(input.password);
  const user = new User({
    id: ids.generate(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date(),
  });
  const createdUser = await userRepo.create(user);

  // Create personal workspace + owner membership
  const workspace = new Workspace({
    id: ids.generate(),
    ownerId: createdUser.id,
    name: 'Mi espacio',
    createdAt: new Date(),
  });
  const createdWorkspace = await workspaceRepo.create(workspace);

  const membership = new Membership({
    id: ids.generate(),
    userId: createdUser.id,
    workspaceId: createdWorkspace.id,
    role: 'owner',
    createdAt: new Date(),
  });
  await membershipRepo.create(membership);

  // AUTH-4: seed accounts + categories into the workspace
  await seedUser(createdWorkspace.id, accountRepo, categoryRepo);

  return { userId: createdUser.id, email: createdUser.email, workspaceId: createdWorkspace.id };
}
