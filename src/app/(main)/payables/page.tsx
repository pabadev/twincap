import { redirect } from "next/navigation";
import { listAccounts } from "../../../core/application/accounts";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { MongoAccountRepository } from "../../../infrastructure/repositories/account-repository";
import { MongoPayableRepository } from "../../../infrastructure/repositories/payable-repository";
import { MongoUserRepository } from "../../../infrastructure/repositories/user-repository";
import { connectDb } from "../../../infrastructure/db/connection";
import { serializeEntities } from "@/lib/serialize";
import { PayablesList } from "./payables-list";

export default async function PayablesPage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const payableRepo = new MongoPayableRepository();
  const userRepo = new MongoUserRepository();
  const user = await userRepo.findById(authUser.userId);
  if (!user) redirect("/login");

  const [accounts, payables] = await Promise.all([
    listAccounts(authUser.workspaceId!, accountRepo),
    payableRepo.findByWorkspaceId(authUser.workspaceId!),
  ]);

  return (
    <PayablesList
      accounts={serializeEntities(accounts)}
      payables={serializeEntities(payables)}
      defaultCurrency={user.defaultCurrency}
    />
  );
}
