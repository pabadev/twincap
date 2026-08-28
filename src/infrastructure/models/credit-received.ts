import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Subdocument shape for an embedded abono. */
export interface CreditReceivedAbonoDoc {
  id: string;
  amount: number;
  date: Date;
  accountId: mongoose.Types.ObjectId;
  movementId?: string;
}

/** Mongoose document shape for CreditReceived. */
export interface CreditReceivedDoc {
  userId: mongoose.Types.ObjectId;
  counterparty: string;
  principal: number;
  accountId: mongoose.Types.ObjectId;
  date: Date;
  installments?: number;
  /** Value per installment (R5-C); present when installments > 0. */
  installmentValue?: number;
  frequency?: string;
  abonos: CreditReceivedAbonoDoc[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreditReceivedDocument = HydratedDocument<CreditReceivedDoc>;

const CreditReceivedAbonoSchema = new Schema<CreditReceivedAbonoDoc>(
  {
    id: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, required: true },
    movementId: { type: String },
  },
  { _id: false },
);

const CreditReceivedSchema = new Schema<CreditReceivedDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    counterparty: {
      type: String,
      required: true,
      trim: true,
    },
    principal: {
      type: Number,
      required: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    installments: {
      type: Number,
    },
    installmentValue: {
      type: Number,
    },
    frequency: {
      type: String,
    },
    abonos: {
      type: [CreditReceivedAbonoSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const CreditReceivedModel =
  mongoose.models["CreditReceived"] ||
  mongoose.model<CreditReceivedDoc>("CreditReceived", CreditReceivedSchema);
