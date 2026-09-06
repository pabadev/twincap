import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Mongoose document shape for CatalogItem. */
export interface CatalogItemDoc {
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  unitPrice: number;
  /** Account currency at creation time — items are currency-immutable (POS-1). */
  currency: string;
  type: "product" | "service";
  /** Only present for products (POS-1). */
  stock?: number;
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
      enum: ["COP", "USD", "MXN", "EUR"],
    },
    type: {
      type: String,
      required: true,
      enum: ["product", "service"],
    },
    stock: {
      type: Number,
    },
  },
  { timestamps: true },
);

export const CatalogItemModel =
  mongoose.models["CatalogItem"] ||
  mongoose.model<CatalogItemDoc>("CatalogItem", CatalogItemSchema);
