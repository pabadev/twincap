import type { Category } from "./category";
import { ValidationError } from "./errors";
import { Money } from "./money";

/** Manual movement types (MOV-1). */
export const MOVEMENT_TYPES = ["income", "expense"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Movement context: manual Personal/Business classification on manual movements; derived by system flows. */
export const MOVEMENT_CONTEXTS = ["Personal", "Business"] as const;
export type MovementContext = (typeof MOVEMENT_CONTEXTS)[number];

/**
 * Kinds of system-linked movements (MOV-5): created by account opening,
 * transfers, credits received/granted, sale payments, and payables
 * (initial payments + abonos). These movements must not be edited or
 * deleted directly by the user.
 */
export const MOVEMENT_LINK_KINDS = [
  "opening",
  "transfer",
  "creditReceivedPrincipal",
  "creditReceivedAbono",
  "creditGrantedPrincipal",
  "creditGrantedAbono",
  "salePayment",
  "payableInitialPayment",
  "payableAbono",
] as const;
export type MovementLinkKind = (typeof MOVEMENT_LINK_KINDS)[number];

export interface MovementLink {
  kind: MovementLinkKind;
  /** Id of the parent operation (account, transfer, credit, or sale). */
  refId: string;
  /** Deterministic operation id — idempotent replay marker (design rev.2 §5). */
  opId: string;
}

export function isMovementType(value: string): value is MovementType {
  return (MOVEMENT_TYPES as readonly string[]).includes(value);
}

export function isMovementContext(value: string): value is MovementContext {
  return (MOVEMENT_CONTEXTS as readonly string[]).includes(value);
}

export function isMovementLinkKind(value: string): value is MovementLinkKind {
  return (MOVEMENT_LINK_KINDS as readonly string[]).includes(value);
}

/** MOV-2: a movement's category must be of the same type. */
export function assertCategoryMatchesMovement(
  category: Pick<Category, "type">,
  movementType: MovementType,
): void {
  if (category.type !== movementType) {
    throw new ValidationError(
      `Category type "${category.type}" does not match movement type "${movementType}"`,
    );
  }
}

/** signedAmount projection: +amount for income, -amount for expense (design rev.2 §2). */
export function signedAmountOf(movementType: MovementType, amountMinorUnits: number): number {
  return movementType === "income" ? amountMinorUnits : -amountMinorUnits;
}

export interface MovementInput {
  id: string;
  userId: string;
  accountId: string;
  category: Category;
  type: MovementType;
  amount: Money;
  date: Date;
  note?: string;
  context?: MovementContext;
  link?: MovementLink;
  createdAt: Date;
}

export class Movement {
  readonly id: string;
  readonly userId: string;
  readonly accountId: string;
  readonly categoryId: string;
  readonly type: MovementType;
  readonly amount: Money;
  /** +amount for income / -amount for expense — computed once, never drifts. */
  readonly signedAmount: number;
  readonly date: Date;
  readonly note?: string;
  readonly context?: MovementContext;
  /** Present only for system-linked movements (opening/transfer/credit/sale). */
  readonly link?: MovementLink;
  readonly createdAt: Date;

  constructor(input: MovementInput) {
    if (input.id.length === 0) {
      throw new ValidationError("Movement id must not be empty");
    }
    if (input.userId.length === 0) {
      throw new ValidationError("Movement userId must not be empty");
    }
    if (input.accountId.length === 0) {
      throw new ValidationError("Movement accountId must not be empty");
    }
    if (!isMovementType(input.type)) {
      throw new ValidationError(`Unknown movement type: ${input.type}`);
    }
    if (input.context !== undefined && !isMovementContext(input.context)) {
      throw new ValidationError(`Unknown movement context: ${String(input.context)}`);
    }
    assertCategoryMatchesMovement(input.category, input.type);
    if (input.link) {
      if (!isMovementLinkKind(input.link.kind)) {
        throw new ValidationError(`Unknown movement link kind: ${String(input.link.kind)}`);
      }
      if (input.link.refId.length === 0) {
        throw new ValidationError("Movement link refId must not be empty");
      }
      if (input.link.opId.length === 0) {
        throw new ValidationError("Movement link opId must not be empty");
      }
    }
    this.id = input.id;
    this.userId = input.userId;
    this.accountId = input.accountId;
    this.categoryId = input.category.id;
    this.type = input.type;
    this.amount = input.amount;
    this.signedAmount = signedAmountOf(input.type, input.amount.amount);
    this.date = input.date;
    this.note = input.note;
    this.context = input.context;
    this.link = input.link;
    this.createdAt = input.createdAt;
  }

  /** True when created by a parent operation and thus not directly editable (MOV-5). */
  isSystemLinked(): boolean {
    return this.link !== undefined;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      accountId: this.accountId,
      categoryId: this.categoryId,
      type: this.type,
      amount: this.amount.toJSON(),
      signedAmount: this.signedAmount,
      date: this.date,
      note: this.note,
      context: this.context,
      link: this.link,
      createdAt: this.createdAt,
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedMovement = ReturnType<Movement['toJSON']>;
