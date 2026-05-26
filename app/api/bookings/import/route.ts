import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, ActivityLog } from "@/lib/db/models";
import { bookingImportRowSchema } from "@/lib/validators/booking";
import type { BookingImportRowInput } from "@/lib/validators/booking";
import { recordBookingForClient } from "@/lib/db/clientTransactions";

export const runtime = "nodejs";

export type ImportErrorEntry = {
  index: number;
  row: Record<string, unknown>;
  field?: string;
  kind: "validation" | "lookup" | "server";
  message: string;
};

export type ImportResult = {
  created: number;
  skipped: number;
  validationErrors: number;
  serverErrors: number;
  errors: ImportErrorEntry[];
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
  const errors: ImportErrorEntry[] = [];

  // Cache clients found/created within this import so duplicate email rows
  // reuse the same client rather than creating duplicates. Stores both the
  // canonical DB id and the stored name so the booking's clientName is always
  // the canonical value regardless of what the CSV row says.
  const clientIdByEmail = new Map<string, { id: string; name: string }>();
  const defaultCurrency = ctx.workspace.currency ?? "PHP";

  for (let i = 0; i < json.rows.length; i++) {
    const raw: Record<string, unknown> = json.rows[i];

    const parsed = bookingImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      const allMessages = parsed.error.errors
        .map((e) => `${e.path.join(".") || "row"}: ${e.message}`)
        .join("; ");
      const firstField = parsed.error.errors[0]?.path?.[0]?.toString();
      errors.push({
        index: i,
        row: raw,
        field: firstField,
        kind: "validation",
        message: allMessages,
      });
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
          clientId = cached.id;
          clientName = cached.name;
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
          clientIdByEmail.set(row.clientEmail, { id: clientId, name: clientName });
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

      // Wrap Booking.create, ActivityLog.create, and recordBookingForClient in
      // a single transaction. If any write fails, the entire row rolls back so
      // the response truthfully reports the row as failed — no partial state.
      const sessionStart = row.startAt;
      const sessionEnd = row.endAt ?? row.startAt;

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const [booking] = await Booking.create(
            [
              {
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
              },
            ],
            { session }
          );

          await ActivityLog.create(
            [
              {
                workspaceId: ctx.workspace._id,
                actorUserId: ctx.userId,
                entity: "booking",
                entityId: booking._id,
                action: "created",
              },
            ],
            { session }
          );

          await recordBookingForClient({
            workspaceId: ctx.workspace._id,
            clientId,
            booking: {
              _id: booking._id,
              amount: booking.amount!,
              firstSessionStart: booking.firstSessionStart,
            },
            source: "import",
            session,
          });
        });

        created.push(i);
      } catch (err) {
        console.error("[bookings.import] row transaction failed", { index: i, err });
        errors.push({
          index: i,
          row: raw,
          kind: "server",
          message: err instanceof Error ? err.message.slice(0, 200) : "Unknown server error",
        });
      } finally {
        await session.endSession();
      }
    } catch (err) {
      console.error("[bookings.import] booking create failed", { index: i, err });
      errors.push({
        index: i,
        row: raw,
        kind: "server",
        message: err instanceof Error ? err.message.slice(0, 200) : "Unknown server error",
      });
    }
  }

  const skipped = errors.length;
  const validationErrors = errors.filter((e) => e.kind === "validation").length;
  const serverErrors = errors.filter((e) => e.kind === "server").length;

  return NextResponse.json(
    { created: created.length, skipped, validationErrors, serverErrors, errors } satisfies ImportResult,
    { status: errors.length === json.rows.length ? 422 : 200 }
  );
}