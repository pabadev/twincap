import mongoose, { Schema, type HydratedDocument } from "mongoose";
import { INVENTORY_UNITS } from "../../core/domain/inventory-units";

export interface ProductFormulaComponentDoc {
  itemId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unit: string;
  stockQuantity: number;
}

export interface ProductFormulaVersionDoc {
  version: number;
  yieldQuantity: number;
  yieldUnit: string;
  yieldStockQuantity: number;
  components: ProductFormulaComponentDoc[];
  createdAt: Date;
}

export interface ProductComboComponentDoc {
  itemId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unit: string;
  stockQuantity: number;
}

export interface ProductComboVersionDoc {
  version: number;
  components: ProductComboComponentDoc[];
  createdAt: Date;
}

/** Mongoose document shape for CatalogItem. */
export interface CatalogItemDoc {
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  unitPrice: number;
  /** Account currency at creation time — items are currency-immutable (POS-1). */
  currency: string;
  type: "product" | "service";
  productRole?: "sellable" | "supply" | "both";
  formulaVersions?: ProductFormulaVersionDoc[];
  comboVersions?: ProductComboVersionDoc[];
  saleUnit?: string;
  /** Only present for products (POS-1). */
  stock?: number;
  /** Total current inventory value in minor units; null means unknown/legacy. */
  inventoryValueMinor?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CatalogItemDocument = HydratedDocument<CatalogItemDoc>;

const CatalogItemSchema = new Schema<CatalogItemDoc>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      enum: ["COP", "USD", "MXN", "EUR", "BRL"],
    },
    type: {
      type: String,
      required: true,
      enum: ["product", "service"],
    },
    productRole: { type: String, enum: ["sellable", "supply", "both"], default: "sellable" },
    formulaVersions: {
      type: [
        new Schema<ProductFormulaVersionDoc>(
          {
            version: { type: Number, required: true, min: 1 },
            yieldQuantity: { type: Number, required: true, min: 0.001 },
            yieldUnit: { type: String, enum: INVENTORY_UNITS, required: true },
            yieldStockQuantity: { type: Number, required: true, min: 1 },
            components: {
              type: [
                new Schema<ProductFormulaComponentDoc>(
                  {
                    itemId: { type: Schema.Types.ObjectId, required: true },
                    name: { type: String, required: true },
                    quantity: { type: Number, required: true, min: 0.001 },
                    unit: { type: String, enum: INVENTORY_UNITS, required: true },
                    stockQuantity: { type: Number, required: true, min: 1 },
                  },
                  { _id: false },
                ),
              ],
              required: true,
            },
            createdAt: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    comboVersions: {
      type: [
        new Schema<ProductComboVersionDoc>(
          {
            version: { type: Number, required: true, min: 1 },
            components: {
              type: [
                new Schema<ProductComboComponentDoc>(
                  {
                    itemId: { type: Schema.Types.ObjectId, required: true },
                    name: { type: String, required: true },
                    quantity: { type: Number, required: true, min: 0.001 },
                    unit: { type: String, enum: INVENTORY_UNITS, required: true },
                    stockQuantity: { type: Number, required: true, min: 1 },
                  },
                  { _id: false },
                ),
              ],
              required: true,
            },
            createdAt: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    saleUnit: {
      type: String,
      enum: INVENTORY_UNITS,
      default: "unit",
    },
    stock: {
      type: Number,
      min: 0,
      validate: {
        validator: (value: number | undefined) =>
          value === undefined || Number.isSafeInteger(value),
        message: "Stock must be stored as a safe integer base quantity",
      },
    },
    inventoryValueMinor: {
      type: Number,
      min: 0,
      validate: {
        validator: (value: number | null | undefined) =>
          value === undefined || value === null || Number.isSafeInteger(value),
        message: "Inventory value must be a non-negative safe integer",
      },
    },
  },
  { timestamps: true },
);

export const CatalogItemModel =
  mongoose.models["CatalogItem"] ||
  mongoose.model<CatalogItemDoc>("CatalogItem", CatalogItemSchema);
