import { redirect } from "next/navigation";
import { listCatalogItems } from "../../../../core/application/catalog";
import { getCurrentUser } from "../../../../infrastructure/auth/getCurrentUser";
import { MongoCatalogItemRepository } from "../../../../infrastructure/repositories/catalog-repository";
import { MongoUserRepository } from "../../../../infrastructure/repositories/user-repository";
import { connectDb } from "../../../../infrastructure/db/connection";
import { serializeEntities } from "@/lib/serialize";
import { CatalogList } from "./catalog-list";

export default async function CatalogPage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  await connectDb();
  const catalogRepo = new MongoCatalogItemRepository();
  const userRepo = new MongoUserRepository();
  const user = await userRepo.findById(authUser.userId);
  if (!user) redirect("/login");

  const items = await listCatalogItems(authUser.workspaceId!, catalogRepo);

  return <CatalogList items={serializeEntities(items)} defaultCurrency={user.defaultCurrency} />;
}
