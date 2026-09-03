import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Subdocument shape for an embedded abono. */
export interface PayableAbonoDoc {
  id: string;
  amount: number;
  date: Date;
  accountId: mongoose.Types.ObjectId;
  movementId?: string;
}

/** Mongoose document shape for Payable. Stores the purchase TOTAL (never net debt). */
export interface PayableDoc {
  workspaceId: mongoose.Types.ObjectId;
  counterparty: string;
  total: number;
  initialPayment: number;
  accountId: mongoose.Types.ObjectId;
  date: Date;
  dueDate?: Date;
  note?: string;
  abonos: PayableAbonoDoc[];
  createdAt: Date;
  updatedAt: Date;
}

export type PayableDocument = HydratedDocument<PayableDoc>;

const PayableAbonoSchema = new Schema<PayableAbonoDoc>(
  {
    id: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, required: true },
    movementId: { type: String },
  },
  { _id: false },
);

const PayableSchema = new Schema<PayableDoc>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    counterparty: {
      type: String,
      required: true,
      trim: true,
    },
    total: {
      type: Number,
      required: true,
    },
    initialPayment: {
      type: Number,
      required: true,
      default: 0,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
    },
    note: {
      type: String,
    },
    abonos: {
      type: [PayableAbonoSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const PayableModel =
  mongoose.models["Payable"] ||
  mongoose.model<PayableDoc>("Payable", PayableSchema);
