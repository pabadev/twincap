import { NextResponse } from "next/server";
import { connectDb } from "../../../../infrastructure/db/connection";
import { getCurrentUser } from "../../../../infrastructure/auth/getCurrentUser";
import { MongoMovementRepository } from "../../../../infrastructure/repositories/movement-repository";
import { listMovementsPaged } from "../../../../core/application/movements";
import { serializeEntities } from "../../../../lib/serialize";

/**
 * H-23 (fundador 2026-11-01): the movements pagination reads live on a ROUTE
 * HANDLER instead of a server action. Server actions invoked from client
 * components run inside the page proxy (CSP/nonce/cookie semantics) and a
 * read action's response can carry the route re-render flight (Next 16
 * re-renders the current route when the response mutates cookies), which
 * remounted the movements list and reset the client-side accumulated
 * "Cargar más" state. API routes are EXCLUDED from the page-proxy matcher:
 * pure JSON, no flight, no cookie writes — the pagination contract is stable
 * by design, not by proxy tuning.
 *
 * GET /api/movements/page?limit=50&scope=Personal&cursorDate=…&cursorCreatedAt=…&cursorId=…
 *
 * All three cursor params are required together for a keyed page; absent or
 * malformed → the first page.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ items: [], nextCursor: null }, { status: 401 });
  }

  const url = new URL(request.url);

  const scopeRaw = url.searchParams.get("scope");
  const context = scopeRaw === "Personal" || scopeRaw === "Business" ? scopeRaw : undefined;

  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 50;

  const cursorDate = validIso(url.searchParams.get("cursorDate"));
  const cursorCreatedAt = validIso(url.searchParams.get("cursorCreatedAt"));
  const cursorId = url.searchParams.get("cursorId");
  const cursor =
    cursorDate && cursorCreatedAt && cursorId
      ? { date: new Date(cursorDate), createdAt: new Date(cursorCreatedAt), id: cursorId }
      : undefined;

  await connectDb();
  const movementRepo = new MongoMovementRepository();
  const result = await listMovementsPaged(user.workspaceId!, limit, movementRepo, cursor, context);

  return NextResponse.json({
    items: serializeEntities(result.items),
    nextCursor: result.nextCursor
      ? {
          date: result.nextCursor.date.toISOString(),
          createdAt: result.nextCursor.createdAt.toISOString(),
          id: result.nextCursor.id,
        }
      : null,
  });
}

/** ISO timestamp validator for the cursor parts (malformed → cursor ignored). */
function validIso(value: string | null): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
}
