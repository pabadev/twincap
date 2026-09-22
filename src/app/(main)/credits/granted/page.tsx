import { redirect } from "next/navigation";
import { listAccounts } from "../../../../core/application/accounts";
import { getCurrentUser } from "../../../../infrastructure/auth/getCurrentUser";
import { MongoAccountRepository } from "../../../../infrastructure/repositories/account-repository";
import { MongoCreditGrantedRepository } from "../../../../infrastructure/repositories/credit-granted-repository";
import { MongoUserRepository } from "../../../../infrastructure/repositories/user-repository";
import { connectDb } from "../../../../infrastructure/db/connection";
import { serializeEntities } from "@/lib/serialize";
import { CreditsGrantedList } from "./credits-granted-list";

export default async function CreditsGrantedPage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const creditRepo = new MongoCreditGrantedRepository();
  const userRepo = new MongoUserRepository();
  const user = await userRepo.findById(authUser.userId);
  if (!user) redirect("/login");

  const [accounts, credits] = await Promise.all([
    listAccounts(authUser.workspaceId!, accountRepo),
    creditRepo.findByWorkspaceId(authUser.workspaceId!),
  ]);

  return (
    <CreditsGrantedList
      accounts={serializeEntities(accounts)}
      credits={serializeEntities(credits)}
      defaultCurrency={user.defaultCurrency}
    />
  );
}
