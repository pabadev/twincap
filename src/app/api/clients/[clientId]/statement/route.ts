import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "../../../../../infrastructure/db/connection";
import { getCurrentUser } from "../../../../../infrastructure/auth/getCurrentUser";
import { MongoClientRepository } from "../../../../../infrastructure/repositories/client-repository";
import { MongoSaleRepository } from "../../../../../infrastructure/repositories/sale-repository";
import { MongoCreditGrantedRepository } from "../../../../../infrastructure/repositories/credit-granted-repository";

const PAGE_SIZE = 250;

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const user = await getCurrentUser();
  if (!user?.workspaceId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { clientId } = await params;
  if (!Types.ObjectId.isValid(clientId))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const query = new URL(request.url).searchParams;
  const from = query.get("from");
  const to = query.get("to");
  if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  await connectDb();
  const clients = new MongoClientRepository();
  const salesRepo = new MongoSaleRepository();
  const creditsRepo = new MongoCreditGrantedRepository();
  const client = await clients.findById(user.workspaceId, clientId);
  if (!client) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const allSales = [];
  let skip = 0;
  while (true) {
    const page = await salesRepo.findByClientIdPage(user.workspaceId, clientId, skip, PAGE_SIZE);
    allSales.push(...page.sales);
    skip += page.sales.length;
    if (skip >= page.total || page.sales.length === 0) break;
  }
  const sales = allSales.filter((sale) => {
    const day = sale.date.toISOString().slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  });
  const credits = await creditsRepo.findBySaleIds(
    user.workspaceId,
    sales.map((sale) => sale.id),
  );
  const pendingBySale = new Map(
    credits.filter((credit) => credit.saleId).map((credit) => [credit.saleId!, credit.pending]),
  );
  return NextResponse.json({
    clientName: client.name,
    sales: sales.map((sale) => ({
      id: sale.id,
      date: sale.date,
      total: sale.total,
      currency: sale.items[0]?.unitPrice.currency ?? "COP",
      pending: pendingBySale.get(sale.id) ?? sale.pending,
      payments: sale.abonos.map((payment) => ({
        amount: payment.amount.amount,
        date: payment.date,
      })),
    })),
  });
}
