import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Mongoose document shape for User. */
export interface UserDoc {
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserDoc>;

const UserSchema = new Schema<UserDoc>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export const UserModel =
  mongoose.models["User"] || mongoose.model<UserDoc>("User", UserSchema);
