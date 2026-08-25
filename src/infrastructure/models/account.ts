import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Mongoose document shape for Account. */
export interface AccountDoc {
  userId: mongoose.Types.ObjectId;
  name: string;
  currency: string;
  isFixed: boolean;
  scope: "Personal" | "Business";
  createdAt: Date;
  updatedAt: Date;
  // NOTE: deliberately NO balance field — balance is derived via aggregation
  // of movement signedAmounts (design rev.2 §2).
}

export type AccountDocument = HydratedDocument<AccountDoc>;

const AccountSchema = new Schema<AccountDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      required: true,
      enum: ["COP", "USD", "MXN", "EUR"],
    },
    isFixed: {
      type: Boolean,
      required: true,
      default: false,
    },
    // D3: single source of truth for Personal/Business. Default covers legacy
    // documents created before the field existed (applied on hydration too).
    scope: {
      type: String,
      required: true,
      enum: ["Personal", "Business"],
      default: "Personal",
    },
  },
  { timestamps: true },
);

export const AccountModel =
  mongoose.models["Account"] ||
  mongoose.model<AccountDoc>("Account", AccountSchema);
