import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Mongoose document shape for Account. */
export interface AccountDoc {
  userId: mongoose.Types.ObjectId;
  name: string;
  currency: string;
  isFixed: boolean;
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
  },
  { timestamps: true },
);

export const AccountModel =
  mongoose.models["Account"] ||
  mongoose.model<AccountDoc>("Account", AccountSchema);
