import { ValidationError } from "./errors";

export interface ClientInput {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  createdAt: Date;
}

export class Client {
  readonly id: string;
  readonly userId: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  readonly createdAt: Date;

  constructor(input: ClientInput) {
    if (input.id.length === 0) {
      throw new ValidationError("Client id must not be empty");
    }
    if (input.userId.length === 0) {
      throw new ValidationError("Client userId must not be empty");
    }
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError("Client name must not be empty");
    }
    this.id = input.id;
    this.userId = input.userId;
    this.name = name;
    this.phone = input.phone.trim();
    this.email = input.email.trim();
    this.note = input.note.trim();
    this.createdAt = input.createdAt;
  }
}
