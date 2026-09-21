import { redirect } from "next/navigation";
import { listAccounts } from "../../../core/application/accounts";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { MongoAccountRepository } from "../../../infrastructure/repositories/account-repository";
import { MongoTransferRepository } from "../../../infrastructure/repositories/transfer-repository";
import { MongoUserRepository } from "../../../infrastructure/repositories/user-repository";
import { connectDb } from "../../../infrastructure/db/connection";
import { serializeEntities } from "@/lib/serialize";
import { TransfersList } from "./transfers-list";

export default async function TransfersPage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const transferRepo = new MongoTransferRepository();
  const userRepo = new MongoUserRepository();
  const user = await userRepo.findById(authUser.userId);
  if (!user) redirect("/login");

  const [accounts, transfers] = await Promise.all([
    listAccounts(authUser.workspaceId!, accountRepo),
    transferRepo.findByWorkspaceId(authUser.workspaceId!),
  ]);

  return (
    <TransfersList
      accounts={serializeEntities(accounts)}
      transfers={serializeEntities(transfers)}
      defaultCurrency={user.defaultCurrency}
    />
  );
}
