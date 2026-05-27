import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, ActivityLog } from "@/lib/db/models";
import { bookingImportRowSchema } from "@/lib/validators/booking";
import type { BookingImportRowInput } from "@/lib/validators/booking";
import { recordBookingForClient } from "@/lib/db/clientTransactions";
import { sessionsAreSameDayInTz, FALLBACK_TZ } from "@/lib/bookings/session-validation";

// Keys added by the CSV exporter for human reference. They carry no import
// semantics and must be stripped before schema validation so that a round-trip
// "export → re-import" works without manual CSV editing.
const EXPORT_ONLY_KEYS = ["booking_id", "session_index"] as const;

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

    // Strip export-only columns before validation so a re-imported CSV succeeds
    // even when it still carries booking_id and session_index columns.
    const rowForParsing: Record<string, unknown> = { ...raw };
    for (const key of EXPORT_ONLY_KEYS) {
      delete rowForParsing[key];
    }

    const parsed = bookingImportRowSchema.safeParse(rowForParsing);
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

    // Authoritative tz-aware single-day check. The Zod schema performs a cheap
    // UTC-day guard; this catches wall-time midnight crossings in the workspace
    // timezone (e.g. Philippines UTC+8: 21:00→02:00 wall-time is same UTC day).
    const sessionEnd = row.endAt ?? row.startAt;
    const tzCheck = sessionsAreSameDayInTz(
      [{ startAt: row.startAt, endAt: sessionEnd }],
      ctx.workspace.timezone ?? FALLBACK_TZ
    );
    if (!tzCheck.ok) {
      errors.push({
        index: i,
        row: raw,
        field: "endAt",
        kind: "validation",
        message: "Session must start and end on the same day in the workspace timezone.",
      });
      continue;
    }

    const session = await mongoose.startSession();
    try {
      // Track whether a new client was resolved inside this transaction so
      // we only populate emailCache after a successful commit. A committed
      // client entry is the only safe source of truth for subsequent rows.
      let committedClient: { id: string; name: string } | null = null;
      // Whether the row's email was already in the cache before this row
      // (cached clients were committed by a previous row's successful tx).
      const cachedEntry = row.clientEmail ? clientIdByEmail.get(row.clientEmail) : undefined;

      await session.withTransaction(async () => {
        // Resolve or create the client INSIDE the transaction so that a
        // subsequent abort rolls back any newly-created client together with
        // the booking and financial writes. We never leave orphan clients.
        let clientId: string;
        let clientName: string;

        if (row.clientEmail) {
          if (cachedEntry) {
            // Already committed by a previous row in this import batch.
            clientId = cachedEntry.id;
            clientName = cachedEntry.name;
          } else {
            let client = await Client.findOne({
              workspaceId: ctx.workspace._id,
              email: row.clientEmail,
            })
              .session(session)
              .lean();
            if (!client) {
              [client] = await Client.create(
                [
                  {
                    workspaceId: ctx.workspace._id,
                    name: row.clientName,
                    email: row.clientEmail,
                    source: "import",
                  },
                ],
                { session }
              );
            }
            clientId = client._id.toString();
            clientName = client.name;
            // Stage for cache population after commit — not before.
            committedClient = { id: clientId, name: clientName };
          }
        } else {
          const [newClient] = await Client.create(
            [
              {
                workspaceId: ctx.workspace._id,
                name: row.clientName,
                source: "import",
              },
            ],
            { session }
          );
          clientId = newClient._id.toString();
          clientName = newClient.name;
          // No email — cannot be cached for deduplication; no-op.
        }

        const sessionStart = row.startAt;
        const sessionEnd = row.endAt ?? row.startAt;

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

      // Only populate the cache after the transaction has been committed.
      // If the transaction aborted, committedClient remains null and the
      // email slot stays empty so a retry can create the client afresh.
      if (committedClient && row.clientEmail) {
        clientIdByEmail.set(row.clientEmail, committedClient);
      }

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
  }

  const skipped = errors.length;
  const validationErrors = errors.filter((e) => e.kind === "validation").length;
  const serverErrors = errors.filter((e) => e.kind === "server").length;

  return NextResponse.json(
    { created: created.length, skipped, validationErrors, serverErrors, errors } satisfies ImportResult,
    { status: errors.length === json.rows.length ? 422 : 200 }
  );
}