import mongoose, { Schema, type HydratedDocument } from "mongoose";
import { CURRENCIES } from "../../core/domain/currency";
import { INVENTORY_UNITS } from "../../core/domain/inventory-units";

export interface InventoryReceiptLineDoc {
  catalogItemId: mongoose.Types.ObjectId;
  quantity: number;
  unit: string;
  stockQuantity: number;
  lineAmount: number;
}

export interface InventoryReceiptDoc {
  workspaceId: mongoose.Types.ObjectId;
  lines: InventoryReceiptLineDoc[];
  total: number;
  currency: string;
  initialPayment: number;
  supplierName?: string;
  reference?: string;
  date: Date;
  accountId: mongoose.Types.ObjectId;
  payableId?: mongoose.Types.ObjectId;
  actorUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InventoryReceiptDocument = HydratedDocument<InventoryReceiptDoc>;

const InventoryReceiptLineSchema = new Schema<InventoryReceiptLineDoc>(
  {
    catalogItemId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: Number.MIN_VALUE },
    unit: { type: String, enum: INVENTORY_UNITS, required: true },
    stockQuantity: { type: Number, required: true, min: 1 },
    lineAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const InventoryReceiptSchema = new Schema<InventoryReceiptDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
    lines: { type: [InventoryReceiptLineSchema], required: true },
    total: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    initialPayment: { type: Number, required: true, min: 0 },
    supplierName: { type: String, trim: true, maxlength: 120 },
    reference: { type: String, trim: true, maxlength: 120 },
    date: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, required: true },
    payableId: { type: Schema.Types.ObjectId, required: false },
    actorUserId: { type: String, required: true },
  },
  { timestamps: true },
);

InventoryReceiptSchema.index({ workspaceId: 1, createdAt: -1 });
InventoryReceiptSchema.index(
  { workspaceId: 1, date: -1, createdAt: -1, _id: -1 },
  { name: "workspace_date_createdAt_id" },
);
InventoryReceiptSchema.index(
  { workspaceId: 1, payableId: 1 },
  { unique: true, partialFilterExpression: { payableId: { $type: "objectId" } } },
);

export const InventoryReceiptModel =
  mongoose.models["InventoryReceipt"] ||
  mongoose.model<InventoryReceiptDoc>("InventoryReceipt", InventoryReceiptSchema);
