import { ValidationError } from "./errors";

export interface ClientInput {
  id: string;
  workspaceId: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  createdAt: Date;
}

export class Client {
  readonly id: string;
  readonly workspaceId: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  readonly createdAt: Date;

  constructor(input: ClientInput) {
    if (input.id.length === 0) {
      throw new ValidationError("Client id must not be empty");
    }
    if (input.workspaceId.length === 0) {
      throw new ValidationError("Client workspaceId must not be empty");
    }
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError("Client name must not be empty");
    }
    this.id = input.id;
    this.workspaceId = input.workspaceId;
    this.name = name;
    this.phone = input.phone.trim();
    this.email = input.email.trim();
    this.note = input.note.trim();
    this.createdAt = input.createdAt;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      name: this.name,
      phone: this.phone,
      email: this.email,
      note: this.note,
      createdAt: this.createdAt,
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedClient = ReturnType<Client['toJSON']>;
