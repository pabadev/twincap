import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Subdocument shape for an embedded abono. */
export interface CreditGrantedAbonoDoc {
  id: string;
  amount: number;
  date: Date;
  accountId: mongoose.Types.ObjectId;
  movementId?: string;
  /** Capital-recovery portion of the abono (R9/D9.3), minor units. */
  capitalAmount?: number;
  /** Interest portion of the abono (R9/D9.3), minor units. */
  interestAmount?: number;
  /** Linked interest movement when the abono split into capital + interest (R9/D9.1). */
  interestMovementId?: string;
}

/** Write-off marker shape (R9/D9.4). */
export interface CreditGrantedWrittenOffDoc {
  date: Date;
  movementId: string;
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
  /** Value per installment (R5-C); present when installments > 0. */
  installmentValue?: number;
  frequency?: string;
  /** Origin POS sale id, when the credit was born from a sale (H14). */
  saleId?: string;
  /** Write-off marker when the credit was written off (R9/D9.4). */
  writtenOff?: CreditGrantedWrittenOffDoc;
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
    capitalAmount: { type: Number },
    interestAmount: { type: Number },
    interestMovementId: { type: String },
  },
  { _id: false },
);

const CreditGrantedWrittenOffSchema = new Schema<CreditGrantedWrittenOffDoc>(
  {
    date: { type: Date, required: true },
    movementId: { type: String, required: true },
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
    installmentValue: {
      type: Number,
    },
    frequency: {
      type: String,
    },
    saleId: {
      type: String,
    },
    writtenOff: {
      type: CreditGrantedWrittenOffSchema,
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
