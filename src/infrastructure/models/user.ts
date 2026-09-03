import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Mongoose document shape for User. */
export interface UserDoc {
  email: string;
  passwordHash: string;
  name?: string;
  locale?: string;
  emailVerified?: boolean;
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
    name: {
      type: String,
      required: false,
      trim: true,
    },
    locale: {
      type: String,
      required: false,
      enum: ['es', 'en'],
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const UserModel =
  mongoose.models["User"] || mongoose.model<UserDoc>("User", UserSchema);
