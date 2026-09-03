import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Subdocument shape for a sale line item. */
export interface SaleLineItemDoc {
  itemId: mongoose.Types.ObjectId;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/** Subdocument shape for an embedded abono (POS-4/5). */
export interface SaleAbonoDoc {
  id: string;
  amount: number;
  date: Date;
  accountId: mongoose.Types.ObjectId;
  movementId?: string;
}

/** Mongoose document shape for Sale. */
export interface SaleDoc {
  workspaceId: mongoose.Types.ObjectId;
  items: SaleLineItemDoc[];
  date: Date;
  paymentMode: "paid-in-full" | "on-credit";
  accountId: mongoose.Types.ObjectId;
  clientId?: mongoose.Types.ObjectId;
  total: number;
  abonos: SaleAbonoDoc[];
  deletedAt?: Date;
  stockRestored: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SaleDocument = HydratedDocument<SaleDoc>;

const SaleLineItemSchema = new Schema<SaleLineItemDoc>(
  {
    itemId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: false },
);

const SaleAbonoSchema = new Schema<SaleAbonoDoc>(
  {
    id: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, required: true },
    movementId: { type: String },
  },
  { _id: false },
);

const SaleSchema = new Schema<SaleDoc>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    items: {
      type: [SaleLineItemSchema],
      required: true,
      validate: {
        validator: (v: SaleLineItemDoc[]) => v.length > 0,
        message: "Sale must have at least one line item",
      },
    },
    date: {
      type: Date,
      required: true,
    },
    paymentMode: {
      type: String,
      required: true,
      enum: ["paid-in-full", "on-credit"],
    },
    accountId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      required: false,
      default: null,
    },
    total: {
      type: Number,
      required: true,
    },
    abonos: {
      type: [SaleAbonoSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
    },
    stockRestored: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const SaleModel =
  mongoose.models["Sale"] ||
  mongoose.model<SaleDoc>("Sale", SaleSchema);
