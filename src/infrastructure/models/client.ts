import mongoose, { Schema, type HydratedDocument } from "mongoose";

/** Mongoose document shape for Client. */
export interface ClientDoc {
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientDocument = HydratedDocument<ClientDoc>;

const ClientSchema = new Schema<ClientDoc>(
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
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

ClientSchema.index({ workspaceId: 1, name: 1 });

export const ClientModel =
  mongoose.models["Client"] ||
  mongoose.model<ClientDoc>("Client", ClientSchema);
