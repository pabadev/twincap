import mongoose, { Schema, type HydratedDocument } from "mongoose";
import { INVENTORY_UNITS } from "../../core/domain/inventory-units";

export interface InventoryStockRecordDoc {
  workspaceId: mongoose.Types.ObjectId;
  catalogItemId: mongoose.Types.ObjectId;
  delta: number;
  unit: string;
  kind: "opening" | "adjustment" | "receipt" | "sale" | "sale-reversal";
  receiptId?: string;
  reason: string;
  saleId?: string;
  actorUserId?: string;
  createdAt: Date;
}

export type InventoryStockRecordDocument = HydratedDocument<InventoryStockRecordDoc>;

const InventoryStockRecordSchema = new Schema<InventoryStockRecordDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
    catalogItemId: { type: Schema.Types.ObjectId, required: true },
    delta: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value) && value !== 0,
        message: "Stock history delta must be a non-zero safe integer",
      },
    },
    unit: { type: String, enum: INVENTORY_UNITS, required: true },
    kind: {
      type: String,
      enum: ["opening", "adjustment", "receipt", "sale", "sale-reversal"],
      required: true,
    },
    receiptId: { type: String },
    reason: { type: String, default: "", trim: true, maxlength: 160 },
    saleId: { type: String },
    actorUserId: { type: String },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

InventoryStockRecordSchema.index({ workspaceId: 1, catalogItemId: 1, createdAt: -1 });

export const InventoryStockRecordModel =
  mongoose.models["InventoryStockRecord"] ||
  mongoose.model<InventoryStockRecordDoc>("InventoryStockRecord", InventoryStockRecordSchema);
