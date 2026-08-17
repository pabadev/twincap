import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Mongoose document shape for Category. */
export interface CategoryDoc {
  userId: mongoose.Types.ObjectId;
  name: string;
  type: "income" | "expense";
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryDocument = HydratedDocument<CategoryDoc>;

const CategorySchema = new Schema<CategoryDoc>(
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
    type: {
      type: String,
      required: true,
      enum: ["income", "expense"],
    },
  },
  { timestamps: true },
);

// CAT-2: name + type must be unique per user
CategorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true });

export const CategoryModel =
  mongoose.models["Category"] ||
  mongoose.model<CategoryDoc>("Category", CategorySchema);
