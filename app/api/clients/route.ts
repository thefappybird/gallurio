import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Client } from "@/lib/db/models";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await requireOrg();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit")) || 25));

  await connectDB();

  const filter: Record<string, unknown> = { workspaceId: ctx.workspace._id };
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const clients = await Client.find(filter)
    .select({ _id: 1, name: 1, email: 1, phone: 1 })
    .sort({ name: 1 })
    .limit(limit)
    .lean();

  return NextResponse.json(
    clients.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      email: c.email ?? null,
      phone: c.phone ?? null,
    }))
  );
}
