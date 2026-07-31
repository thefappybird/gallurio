import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, ActivityLog, Team } from "@/lib/db/models";
import { bookingImportRowSchema } from "@/lib/validators/booking";
import type { BookingImportRowInput } from "@/lib/validators/booking";
import { recordBookingForClient } from "@/lib/db/clientTransactions";
import { sessionsAreSameDayInTz, FALLBACK_TZ } from "@/lib/bookings/session-validation";
import {
  groupImportRows,
  MAX_SESSIONS_PER_BOOKING,
} from "@/lib/bookings/import-grouping";
import { rateLimit } from "@/lib/server/rateLimit";
import { parseCsv, stripFormulaGuard } from "@/lib/utils/csv-parse";
import { parseXlsxToRows, looksLikeXlsx } from "@/lib/utils/xlsx";

export const runtime = "nodejs";

/** Hard byte cap applied BEFORE parsing — exceljs decompresses in memory. */
const MAX_UPLOAD_BYTES = 2_000_000;
/** Rows are what the user sees, so the cap is on rows, not bookings. */
const MAX_ROWS = 500;

export type ImportErrorEntry = {
  index: number;
  row: Record<string, unknown>;
  field?: string;
  kind: "validation" | "lookup" | "server";
  message: string;
};

export type ImportResult = {
  created: number;
  /** Bookings matched by booking_id and updated in place rather than duplicated. */
  updated: number;
  /**
   * Source ROWS that were not written. Once rows are grouped into bookings a
   * single failure can skip several rows, so this is no longer equal to
   * errors.length.
   */
  skipped: number;
  validationErrors: number;
  serverErrors: number;
  errors: ImportErrorEntry[];
};

export async function POST(req: Request) {
  const ctx = await requireOrg();

  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Bulk writes across a whole workspace: cheap to fire, expensive to absorb.
  if (
    !rateLimit(`bookings:import:${ctx.workspace._id.toString()}`, {
      limit: 10,
      windowMs: 300_000,
    }).ok
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Two shapes on one route:
  //   multipart/form-data -> PREVIEW. Parse + validate, write NOTHING.
  //   application/json     -> COMMIT. Everything re-validated below.
  // XLSX is binary, so parsing lives server-side rather than shipping a
  // spreadsheet library to the browser for an owner-only, occasional action.
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    // A missing part, or a text field where a file was expected, is a bad
    // request — not an unhandled read of `.size` on null.
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "invalid_format" }, { status: 400 });
    }
    // Bites BEFORE the parse: exceljs decompresses in memory, so the byte cap
    // is the real defense against a zip bomb, not a post-parse row count.
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "import_too_large" }, { status: 413 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Sniff rather than trust the extension: .xlsx is a zip container.
    let parsed;
    try {
      parsed = looksLikeXlsx(bytes)
        ? await parseXlsxToRows(Buffer.from(bytes))
        : parseCsv(new TextDecoder().decode(bytes));
    } catch {
      // A crafted or truncated upload is the caller's problem, not a 500.
      return NextResponse.json({ error: "unreadable_file" }, { status: 400 });
    }
    // Same cap the commit enforces: a preview that cannot be imported is not
    // worth serializing back to the browser and validating row by row.
    if (parsed.rows.length > MAX_ROWS) {
      return NextResponse.json({ error: "too_many_rows" }, { status: 400 });
    }
    return NextResponse.json({ preview: true, headers: parsed.headers, rows: parsed.rows });
  }

  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const json = await req.json().catch(() => ({}));
  if (!Array.isArray(json.rows) || json.rows.length === 0) {
    return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
  }
  if (json.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: "Maximum 500 rows per import" }, { status: 400 });
  }

  await connectDB();

  const mainTeam = await Team.findOne({ workspaceId: ctx.workspace._id, isDefault: true })
    .select({ _id: 1 })
    .lean();
  if (!mainTeam) {
    return NextResponse.json({ error: "No default team for workspace" }, { status: 500 });
  }

  const created: number[] = [];
  const updated: number[] = [];
  /**
   * Undo the exporter's anti-formula apostrophe. Applied here rather than at
   * parse time so a row POSTed directly — not just one that came back from the
   * preview — is cleaned too. Only strings are touched; stripFormulaGuard
   * removes at most one leading "'" and only when a trigger follows it.
   */
  const unguardRow = (row: unknown): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === "string" ? stripFormulaGuard(v) : v,
      ])
    );

  const errors: ImportErrorEntry[] = [];
  /**
   * Source rows left unwritten. A failing multi-session group is one error but
   * several skipped rows, so this is deliberately not errors.length.
   */
  let skippedRows = 0;

  // Cache clients found/created within this import so duplicate email rows
  // reuse the same client rather than creating duplicates. Stores both the
  // canonical DB id and the stored name so the booking's clientName is always
  // the canonical value regardless of what the CSV row says.
  const clientIdByEmail = new Map<string, { id: string; name: string }>();
  const defaultCurrency = ctx.workspace.currency ?? "PHP";

  // Rows sharing a booking_id are ONE multi-session booking. Grouping is what
  // makes the exporter's one-row-per-session output round-trip instead of
  // fanning out into N separate bookings. Rows without a booking_id keep the
  // original one-row-one-booking behaviour.
  const groups = groupImportRows(json.rows as Record<string, unknown>[]);

  for (const group of groups) {
    // Errors are reported against the group's first source row.
    const i = group.rowNumbers[0] - 1;
    const raw: Record<string, unknown> = group.rows[0] as Record<string, unknown>;

    if (group.error === "too_many_sessions") {
      errors.push({
        index: i,
        row: raw,
        field: "sessionIndex",
        kind: "validation",
        message: `A booking cannot have more than ${MAX_SESSIONS_PER_BOOKING} sessions.`,
      });
      skippedRows += group.rows.length;
      continue;
    }

    // Export-only columns (payments, invoiceNumber, teamName, createdAt) ride
    // along harmlessly: the row schema is non-strict, so unknown keys are
    // dropped. booking_id / client_id / session_index are now real fields —
    // normalizeCsvHeader maps them, and the schema reads them.
    const parsedRows: BookingImportRowInput[] = [];
    let rowError: ImportErrorEntry | null = null;

    for (let r = 0; r < group.rows.length; r++) {
      const parsed = bookingImportRowSchema.safeParse(unguardRow(group.rows[r]));
      if (!parsed.success) {
        const allMessages = parsed.error.errors
          .map((e) => `${e.path.join(".") || "row"}: ${e.message}`)
          .join("; ");
        rowError = {
          index: group.rowNumbers[r] - 1,
          row: group.rows[r] as Record<string, unknown>,
          field: parsed.error.errors[0]?.path?.[0]?.toString(),
          kind: "validation",
          message: allMessages,
        };
        break;
      }
      parsedRows.push(parsed.data);
    }
    if (rowError) {
      errors.push(rowError);
      skippedRows += group.rows.length;
      continue;
    }

    // Booking-level fields come from the group's first row; later rows in a
    // group contribute only their session.
    const row: BookingImportRowInput = parsedRows[0];

    // A booking_id in the file is a hint, never authority. Re-read it scoped to
    // the caller's workspace so a foreign (or bogus) id can never be written
    // to. Both cases answer the same way, so this is not an existence oracle.
    let existingBooking:
      | { _id: mongoose.Types.ObjectId; clientId: mongoose.Types.ObjectId }
      | null = null;
    if (group.bookingId) {
      existingBooking = mongoose.isValidObjectId(group.bookingId)
        ? await Booking.findOne({
            _id: group.bookingId,
            workspaceId: ctx.workspace._id,
          })
            .select({ _id: 1, clientId: 1 })
            .lean()
        : null;

      if (!existingBooking) {
        errors.push({
          index: i,
          row: raw,
          field: "bookingId",
          kind: "lookup",
          message: "booking_not_found_in_workspace",
        });
        skippedRows += group.rows.length;
        continue;
      }
    }

    // Authoritative tz-aware single-day check. The Zod schema performs a cheap
    // UTC-day guard; this catches wall-time midnight crossings in the workspace
    // timezone (e.g. Philippines UTC+8: 21:00→02:00 wall-time is same UTC day).
    const sessions = parsedRows.map((r) => ({
      startAt: r.startAt,
      endAt: r.endAt ?? r.startAt,
    }));
    const tzCheck = sessionsAreSameDayInTz(
      sessions,
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
      skippedRows += group.rows.length;
      continue;
    }

    const firstSessionStart = new Date(
      Math.min(...sessions.map((s) => s.startAt.getTime()))
    );
    const lastSessionEnd = new Date(
      Math.max(...sessions.map((s) => s.endAt.getTime()))
    );

    // ── update path ────────────────────────────────────────────────────────
    // clientId/clientName are deliberately NOT reassigned here: moving a
    // booking between clients rewrites the transaction ledger, which stays a
    // drawer operation. Amounts are likewise left alone — they are ledger-
    // linked, so a spreadsheet must not be able to desynchronise them.
    if (existingBooking) {
      try {
        await Booking.updateOne(
          { _id: existingBooking._id, workspaceId: ctx.workspace._id },
          {
            $set: {
              title: row.title,
              eventType: row.eventType ?? "other",
              status: row.status ?? "booked",
              sessions,
              firstSessionStart,
              lastSessionEnd,
              "location.address": row.locationAddress ?? "",
              "location.lat": row.locationLat ?? null,
              "location.lng": row.locationLng ?? null,
              notes: row.notes ?? "",
            },
          }
        );
        await ActivityLog.create({
          workspaceId: ctx.workspace._id,
          actorUserId: ctx.userId,
          entity: "booking",
          entityId: existingBooking._id,
          action: "updated",
          meta: { via: "import" },
        });
        updated.push(i);
      } catch (err) {
        console.error("[bookings.import] group update failed", { index: i, err });
        errors.push({
          index: i,
          row: raw,
          kind: "server",
          message: err instanceof Error ? err.message.slice(0, 200) : "Unknown server error",
        });
        skippedRows += group.rows.length;
      }
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

        // Resolution ladder. clientId wins because it is exact; email is the
        // legacy path; otherwise a new client is created. Deliberately NOT
        // matched by name: a workspace may legitimately hold several clients
        // sharing a name, so silently merging them here would destroy data.
        const explicitClient = row.clientId
          ? mongoose.isValidObjectId(row.clientId)
            ? await Client.findOne({
                _id: row.clientId,
                workspaceId: ctx.workspace._id,
              })
                .session(session)
                .lean()
            : null
          : undefined;

        if (row.clientId && !explicitClient) {
          throw new Error("client_not_found_in_workspace");
        }

        if (explicitClient) {
          clientId = explicitClient._id.toString();
          clientName = explicitClient.name;
        } else if (row.clientEmail) {
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
                    phone: row.clientPhone ?? null,
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
                phone: row.clientPhone ?? null,
                source: "import",
              },
            ],
            { session }
          );
          clientId = newClient._id.toString();
          clientName = newClient.name;
          // No email — cannot be cached for deduplication; no-op.
        }

        const [booking] = await Booking.create(
          [
            {
              workspaceId: ctx.workspace._id,
              teamId: mainTeam._id,
              clientId,
              clientName,
              title: row.title,
              eventType: row.eventType ?? "other",
              status: row.status ?? "booked",
              sessions,
              firstSessionStart,
              lastSessionEnd,
              location: {
                address: row.locationAddress ?? "",
                lat: row.locationLat ?? null,
                lng: row.locationLng ?? null,
              },
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
            teamId: booking.teamId,
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
        kind: err instanceof Error && err.message === "client_not_found_in_workspace"
          ? "lookup"
          : "server",
        message: err instanceof Error ? err.message.slice(0, 200) : "Unknown server error",
      });
      skippedRows += group.rows.length;
    } finally {
      await session.endSession();
    }
  }

  const skipped = skippedRows;
  const validationErrors = errors.filter((e) => e.kind === "validation").length;
  const serverErrors = errors.filter((e) => e.kind === "server").length;

  return NextResponse.json(
    {
      created: created.length,
      updated: updated.length,
      skipped,
      validationErrors,
      serverErrors,
      errors,
    } satisfies ImportResult,
    { status: errors.length === json.rows.length ? 422 : 200 }
  );
}