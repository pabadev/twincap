import { revokeAllMcpConnections, revokeMcpConnection } from "./mcp-actions";

type Grant = {
  id: string;
  clientName: string;
  capabilities: string[];
  consentedAt: string;
  lastUsedAt?: string | null;
};

export function McpConnections({
  grants,
  labels,
}: {
  grants: Grant[];
  labels: {
    title: string;
    description: string;
    none: string;
    granted: string;
    lastUsed: string;
    revoke: string;
    revokeAll: string;
    permission: string;
    summaryRead: string;
  };
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h2 className="text-lg font-semibold">{labels.title}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{labels.description}</p>
      </div>
      {grants.length === 0 ? (
        <p className="text-sm text-zinc-500">{labels.none}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {grants.map((grant) => (
            <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={grant.id}>
              <div>
                <p className="font-medium">{grant.clientName}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {labels.permission}:{" "}
                  {grant.capabilities
                    .map((capability) =>
                      capability === "personal.summary:read" ? labels.summaryRead : capability,
                    )
                    .join(", ")}
                </p>
                <p className="text-xs text-zinc-500">
                  {labels.granted}: {grant.consentedAt}
                  {grant.lastUsedAt ? ` · ${labels.lastUsed}: ${grant.lastUsedAt}` : ""}
                </p>
              </div>
              <form action={revokeMcpConnection}>
                <input type="hidden" name="grantId" value={grant.id} />
                <button className="rounded-lg border px-3 py-2 text-sm" type="submit">
                  {labels.revoke}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {grants.length > 1 && (
        <form action={revokeAllMcpConnections}>
          <button
            className="text-sm font-medium text-red-700 underline dark:text-red-400"
            type="submit"
          >
            {labels.revokeAll}
          </button>
        </form>
      )}
    </section>
  );
}
