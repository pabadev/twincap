import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Mongoose document shape for Workspace. */
export interface WorkspaceDoc {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  country?: string;
  currency?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceDocument = HydratedDocument<WorkspaceDoc>;

const WorkspaceSchema = new Schema<WorkspaceDoc>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      default: "active",
    },
  },
  { timestamps: true },
);

export const WorkspaceModel =
  mongoose.models["Workspace"] ||
  mongoose.model<WorkspaceDoc>("Workspace", WorkspaceSchema);
