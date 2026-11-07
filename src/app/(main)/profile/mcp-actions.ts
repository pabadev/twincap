"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/infrastructure/auth/getCurrentUser";
import { connectDb } from "@/infrastructure/db/connection";
import { revokeAllGrantsForUser, revokeGrant } from "@/infrastructure/mcp/oauth-service";

export async function revokeMcpConnection(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const grantId = formData.get("grantId");
  if (!user || typeof grantId !== "string") return;
  await connectDb();
  await revokeGrant(grantId, user.userId);
  revalidatePath("/profile");
}

export async function revokeAllMcpConnections(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await connectDb();
  await revokeAllGrantsForUser(user.userId);
  revalidatePath("/profile");
}
