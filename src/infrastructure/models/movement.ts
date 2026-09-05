import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Subdocument shape for Movement.link. */
export interface MovementLinkDoc {
  kind: string;
  refId: string;
  /**
   * For credit abonos born from a sale (kind creditGrantedAbono with Business
   * context), the id of the originating sale (I12). Optional by design.
   */
  saleId?: string;
  /** Deterministic operation id — idempotent replay marker (design rev.2 §5). */
  opId: string;
}

/** Mongoose document shape for Movement. */
export interface MovementDoc {
  workspaceId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  type: "income" | "expense";
  /** Amount in integer minor units. */
  amount: number;
  /** Projection of type + amount: +amount for income, -amount for expense. */
  signedAmount: number;
  date: Date;
  note?: string;
  context?: "Personal" | "Business";
  categoryId: mongoose.Types.ObjectId;
  link?: MovementLinkDoc;
  createdAt: Date;
  updatedAt: Date;
}

export type MovementDocument = HydratedDocument<MovementDoc>;

const MovementLinkSchema = new Schema<MovementLinkDoc>(
  {
    kind: { type: String, required: true },
    refId: { type: String, required: true },
    saleId: { type: String },
    opId: { type: String, required: true },
  },
  { _id: false },
);

const MovementSchema = new Schema<MovementDoc>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["income", "expense"],
    },
    amount: {
      type: Number,
      required: true,
    },
    signedAmount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    note: {
      type: String,
    },
    context: {
      type: String,
      enum: ["Personal", "Business"],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    link: {
      type: MovementLinkSchema,
    },
  },
  { timestamps: true },
);

// MOV-5: partial unique index on link.opId for idempotent replay
MovementSchema.index(
  { "link.opId": 1 },
  {
    unique: true,
    partialFilterExpression: { "link.opId": { $exists: true } },
  },
);

export const MovementModel =
  mongoose.models["Movement"] ||
  mongoose.model<MovementDoc>("Movement", MovementSchema);
