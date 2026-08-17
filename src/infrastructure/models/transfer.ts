import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Subdocument shape for Transfer.movementIds. */
export interface TransferMovementIdsDoc {
  expenseId?: string;
  incomeId?: string;
}

/** Mongoose document shape for Transfer. */
export interface TransferDoc {
  userId: mongoose.Types.ObjectId;
  sourceAccountId: mongoose.Types.ObjectId;
  destinationAccountId: mongoose.Types.ObjectId;
  sourceAmount: number;
  destinationAmount: number;
  sourceCurrency: string;
  destinationCurrency: string;
  rate?: number;
  date: Date;
  note?: string;
  movementIds?: TransferMovementIdsDoc;
  createdAt: Date;
  updatedAt: Date;
}

export type TransferDocument = HydratedDocument<TransferDoc>;

const TransferMovementIdsSchema = new Schema<TransferMovementIdsDoc>(
  {
    expenseId: { type: String },
    incomeId: { type: String },
  },
  { _id: false },
);

const TransferSchema = new Schema<TransferDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    sourceAccountId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    destinationAccountId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    sourceAmount: {
      type: Number,
      required: true,
    },
    destinationAmount: {
      type: Number,
      required: true,
    },
    sourceCurrency: {
      type: String,
      required: true,
      enum: ["COP", "USD", "MXN", "EUR"],
    },
    destinationCurrency: {
      type: String,
      required: true,
      enum: ["COP", "USD", "MXN", "EUR"],
    },
    rate: {
      type: Number,
    },
    date: {
      type: Date,
      required: true,
    },
    note: {
      type: String,
    },
    movementIds: {
      type: TransferMovementIdsSchema,
    },
  },
  { timestamps: true },
);

export const TransferModel =
  mongoose.models["Transfer"] ||
  mongoose.model<TransferDoc>("Transfer", TransferSchema);
