import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Mongoose document shape for Membership. */
export interface MembershipDoc {
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export type MembershipDocument = HydratedDocument<MembershipDoc>;

const MembershipSchema = new Schema<MembershipDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      default: "member",
    },
    status: {
      type: String,
      required: true,
      default: "active",
    },
  },
  { timestamps: true },
);

// A user has at most one membership per workspace.
MembershipSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });

export const MembershipModel =
  mongoose.models["Membership"] ||
  mongoose.model<MembershipDoc>("Membership", MembershipSchema);
