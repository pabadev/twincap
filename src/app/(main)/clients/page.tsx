import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getT } from "../../../i18n/server";
import { listClients } from "../../../core/application/clients";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { MongoClientRepository } from "../../../infrastructure/repositories/client-repository";
import { connectDb } from "../../../infrastructure/db/connection";
import { ClientsPageClient } from "./clients-page-client";
import { ClientsList, type SerializedClient } from "./clients-list";
import { EmptyState } from "../../../components/ui/empty-state";
import { Icon } from "../../../components/ui/icon";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user || !user.workspaceId) {
    redirect("/login");
  }

  const t = await getT("Clients");

  await connectDb();
  const clientRepo = new MongoClientRepository();
  const clients = await listClients(user.workspaceId, clientRepo);
  const serializedClients: SerializedClient[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    note: c.note,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <ClientsPageClient />
      </div>

      {serializedClients.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Users} size="xl" />}
          title={t("noClients")}
          description={t("emptyDescription")}
        />
      ) : (
        <ClientsList clients={serializedClients} />
      )}
    </div>
  );
}
