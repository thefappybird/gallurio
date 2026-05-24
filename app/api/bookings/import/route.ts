import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, ActivityLog } from "@/lib/db/models";
import { bookingImportRowSchema } from "@/lib/validators/booking";
import type { BookingImportRowInput } from "@/lib/validators/booking";

export const runtime = "nodejs";

export type ImportResult = {
  created: number;
  errors: { index: number; message: string }[];
};

export async function POST(req: Request) {
  const ctx = await requireOrg();

  const json = await req.json().catch(() => ({}));
  if (!Array.isArray(json.rows) || json.rows.length === 0) {
    return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
  }
  if (json.rows.length > 500) {
    return NextResponse.json({ error: "Maximum 500 rows per import" }, { status: 400 });
  }

  await connectDB();

  const created: number[] = [];
  const errors: { index: number; message: string }[] = [];

  // Cache clients found/created within this import so duplicate email rows
  // reuse the same client rather than creating duplicates.
  const clientIdByEmail = new Map<string, string>();
  const defaultCurrency = ctx.workspace.currency ?? "PHP";

  for (let i = 0; i < json.rows.length; i++) {
    const raw = json.rows[i];

    const parsed = bookingImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Invalid row";
      errors.push({ index: i, message: msg });
      continue;
    }

    const row: BookingImportRowInput = parsed.data;

    try {
      // Resolve or create the client.
      let clientId: string;
      let clientName: string;

      if (row.clientEmail) {
        const cached = clientIdByEmail.get(row.clientEmail);
        if (cached) {
          clientId = cached;
          clientName = row.clientName;
        } else {
          let client = await Client.findOne({
            workspaceId: ctx.workspace._id,
            email: row.clientEmail,
          }).lean();
          if (!client) {
            client = await Client.create({
              workspaceId: ctx.workspace._id,
              name: row.clientName,
              email: row.clientEmail,
              source: "import",
            });
          }
          clientId = client._id.toString();
          clientName = client.name;
          clientIdByEmail.set(row.clientEmail, clientId);
        }
      } else {
        const newClient = await Client.create({
          workspaceId: ctx.workspace._id,
          name: row.clientName,
          source: "import",
        });
        clientId = newClient._id.toString();
        clientName = newClient.name;
      }

      // CSV rows are flat (one row = one single-session booking).
      const sessionStart = row.startAt;
      const sessionEnd = row.endAt ?? row.startAt;
      const booking = await Booking.create({
        workspaceId: ctx.workspace._id,
        clientId,
        clientName,
        title: row.title,
        eventType: row.eventType ?? "other",
        status: row.status ?? "inquiry",
        sessions: [{ startAt: sessionStart, endAt: sessionEnd }],
        firstSessionStart: sessionStart,
        lastSessionEnd: sessionEnd,
        location: { address: row.locationAddress ?? "" },
        amount: {
          total: row.amountTotal ?? 0,
          deposit: row.amountDeposit ?? 0,
          currency: row.currency ?? defaultCurrency,
        },
        notes: row.notes ?? "",
      });

      await ActivityLog.create({
        workspaceId: ctx.workspace._id,
        actorUserId: ctx.userId,
        entity: "booking",
        entityId: booking._id,
        action: "created",
      });

      created.push(i);
    } catch {
      errors.push({ index: i, message: "Server error creating booking" });
    }
  }

  return NextResponse.json(
    { created: created.length, errors } satisfies ImportResult,
    { status: errors.length === json.rows.length ? 422 : 200 }
  );
}
