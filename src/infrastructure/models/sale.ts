import mongoose, { Schema, type HydratedDocument } from "mongoose";
import { INVENTORY_UNITS } from "../../core/domain/inventory-units";

/** Subdocument shape for a sale line item. */
export interface SaleLineItemDoc {
  itemId: mongoose.Types.ObjectId;
  quantity: number;
  unit?: string;
  stockQuantity?: number;
  unitPrice: number;
  subtotal: number;
  formulaSnapshot?: {
    version: number;
    outputQuantity: number;
    outputUnit: string;
    components: Array<{
      itemId: mongoose.Types.ObjectId;
      name: string;
      unit: string;
      stockQuantity: number;
    }>;
  };
  comboSnapshot?: {
    version: number;
    components: Array<{
      itemId: mongoose.Types.ObjectId;
      name: string;
      unit: string;
      stockQuantity: number;
    }>;
  };
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
    unit: { type: String, enum: INVENTORY_UNITS, default: "unit" },
    stockQuantity: {
      type: Number,
      min: 1,
      validate: {
        validator: (value: number | undefined) =>
          value === undefined || Number.isSafeInteger(value),
        message: "Sale stock quantity must be a safe integer",
      },
    },
    unitPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    formulaSnapshot: {
      type: new Schema(
        {
          version: { type: Number, required: true },
          outputQuantity: { type: Number, required: true },
          outputUnit: { type: String, enum: INVENTORY_UNITS, required: true },
          components: {
            type: [
              new Schema(
                {
                  itemId: { type: Schema.Types.ObjectId, required: true },
                  name: { type: String, required: true },
                  unit: { type: String, enum: INVENTORY_UNITS, required: true },
                  stockQuantity: { type: Number, min: 1, required: true },
                },
                { _id: false },
              ),
            ],
            required: true,
          },
        },
        { _id: false },
      ),
      required: false,
    },
    comboSnapshot: {
      type: new Schema(
        {
          version: { type: Number, required: true },
          components: {
            type: [
              new Schema(
                {
                  itemId: { type: Schema.Types.ObjectId, required: true },
                  name: { type: String, required: true },
                  unit: { type: String, enum: INVENTORY_UNITS, required: true },
                  stockQuantity: { type: Number, min: 1, required: true },
                },
                { _id: false },
              ),
            ],
            required: true,
          },
        },
        { _id: false },
      ),
      required: false,
    },
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

SaleSchema.index({ workspaceId: 1, clientId: 1, date: -1, createdAt: -1 });
SaleSchema.index({ workspaceId: 1, "items.itemId": 1 });

export const SaleModel = mongoose.models["Sale"] || mongoose.model<SaleDoc>("Sale", SaleSchema);
