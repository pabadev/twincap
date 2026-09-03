import { ValidationError } from "./errors";

export interface WorkspaceInput {
  id: string;
  /** The User whose personal workspace this is (beta: 1 user = 1 personal workspace). */
  ownerId: string;
  name: string;
  country?: string;
  currency?: string;
  status?: WorkspaceStatus;
  createdAt: Date;
}

export const WORKSPACE_STATUSES = ["active", "suspended"] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export class Workspace {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly country?: string;
  readonly currency?: string;
  readonly status: WorkspaceStatus;
  readonly createdAt: Date;

  constructor(input: WorkspaceInput) {
    if (input.id.length === 0) {
      throw new ValidationError("Workspace id must not be empty");
    }
    if (input.ownerId.length === 0) {
      throw new ValidationError("Workspace ownerId must not be empty");
    }
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError("Workspace name must not be empty");
    }
    const status = input.status ?? "active";
    if (!WORKSPACE_STATUSES.includes(status)) {
      throw new ValidationError(`Invalid workspace status: ${status}`);
    }
    this.id = input.id;
    this.ownerId = input.ownerId;
    this.name = name;
    this.country = input.country?.trim() || undefined;
    this.currency = input.currency?.trim() || undefined;
    this.status = status;
    this.createdAt = input.createdAt;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      ownerId: this.ownerId,
      name: this.name,
      country: this.country,
      currency: this.currency,
      status: this.status,
      createdAt: this.createdAt,
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedWorkspace = ReturnType<Workspace['toJSON']>;
