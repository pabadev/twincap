import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Subdocument shape for an embedded abono. */
export interface CreditGrantedAbonoDoc {
  id: string;
  amount: number;
  date: Date;
  accountId: mongoose.Types.ObjectId;
  movementId?: string;
}

/** Mongoose document shape for CreditGranted. */
export interface CreditGrantedDoc {
  userId: mongoose.Types.ObjectId;
  /** Debtor name. */
  counterparty: string;
  principal: number;
  accountId: mongoose.Types.ObjectId;
  date: Date;
  installments?: number;
  frequency?: string;
  /** Origin POS sale id, when the credit was born from a sale (H14). */
  saleId?: string;
  abonos: CreditGrantedAbonoDoc[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreditGrantedDocument = HydratedDocument<CreditGrantedDoc>;

const CreditGrantedAbonoSchema = new Schema<CreditGrantedAbonoDoc>(
  {
    id: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, required: true },
    movementId: { type: String },
  },
  { _id: false },
);

const CreditGrantedSchema = new Schema<CreditGrantedDoc>(
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
    frequency: {
      type: String,
    },
    saleId: {
      type: String,
    },
    abonos: {
      type: [CreditGrantedAbonoSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const CreditGrantedModel =
  mongoose.models["CreditGranted"] ||
  mongoose.model<CreditGrantedDoc>("CreditGranted", CreditGrantedSchema);
