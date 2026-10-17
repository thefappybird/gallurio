import { emitDataChanged } from "@/lib/sockets/emitDataChanged";
import { after, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, ActivityLog, Team } from "@/lib/db/models";
import { BookingImportJob } from "@/lib/db/models/BookingImportJob";
import { BookingImportJobItem } from "@/lib/db/models/BookingImportJobItem";
import { bookingImportRowSchema } from "@/lib/validators/booking";
import type { BookingImportRowInput } from "@/lib/validators/booking";
import { recordBookingForClient, syncBookingPaymentsForClient } from "@/lib/db/clientTransactions";
import { isCompletionEligible, normalizePayments } from "@/lib/bookings/payment-rules";
import { resolveFxFreeze } from "@/lib/pricing/fxRates";
import { sessionsAreSameDayInTz, FALLBACK_TZ } from "@/lib/bookings/session-validation";
import {
  groupImportRows,
  MAX_SESSIONS_PER_BOOKING,
  type ImportGroup,
} from "@/lib/bookings/import-grouping";
import { rateLimit } from "@/lib/server/rateLimit";
import { parseCsv, stripFormulaGuard, decodeCsvBytes, isProbablyText } from "@/lib/utils/csv-parse";
import { serializeCsv } from "@/lib/utils/csv-serialize";
import { parseXlsxToRows, looksLikeXlsx, rowsToXlsxBuffer } from "@/lib/utils/xlsx";
import {
  IMPORT_TEMPLATE_HEADERS,
  buildImportTemplateRows,
} from "@/lib/bookings/import-template";
import { resolveWorkspaceTimezone } from "@/lib/utils/timezone";

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

/** One row that matches a booking already in the workspace. */
export type DuplicateWarning = {
  index: number;
  title: string;
  /** Team the existing booking sits on, so the warning can name it. */
  teamName: string | null;
};

/** Returned INSTEAD of a result when the file looks already imported. */
export type DuplicateCheck = {
  needsConfirmation: true;
  duplicates: DuplicateWarning[];
};

export type ImportResult = {
  created: number;
  /** Bookings matched by booking_id and updated in place rather than duplicated. */
  updated: number;
  /** Successful session rows, including sessions on updated bookings. */
  shifts: number;
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

type ImportContext = {
  userId: string;
  workspace: {
    _id: mongoose.Types.ObjectId;
    currency?: string | null;
    timezone?: string | null;
  };
};

type ImportPayload = {
  rows: Record<string, unknown>[];
  teamId?: unknown;
  confirmDuplicates?: boolean;
};

type JobOutcome = {
  created?: number;
  updated?: number;
  shifts?: number;
  skipped?: number;
  error?: ImportErrorEntry;
};

type JobRun = {
  id: mongoose.Types.ObjectId;
  token: string;
  doneIndices: Set<number>;
};

const JOB_LEASE_MS = 180_000;
const MAX_COMMIT_BYTES = 8_000_000;

/**
 * Downloadable import template, in the same two formats the importer accepts.
 *
 * Server-side because XLSX is a zip: generating it in the browser would mean
 * shipping a spreadsheet library for an owner-only, occasional click. The CSV
 * comes from here too so both formats can never disagree.
 */
export async function GET(req: Request) {
  const ctx = await requireOrg();

  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  if (params.has("jobId") || params.has("requestId") || params.has("latest")) {
    return getImportJobStatus(ctx, params);
  }

  const format = params.get("format") ?? "csv";
  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  const rows = buildImportTemplateRows(
    resolveWorkspaceTimezone(ctx.workspace),
    ctx.workspace.currency ?? "PHP"
  );

  if (format === "xlsx") {
    const buffer = await rowsToXlsxBuffer(IMPORT_TEMPLATE_HEADERS, rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bookings-import-template.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(serializeCsv(IMPORT_TEMPLATE_HEADERS, rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-import-template.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  const ctx = await requireOrg();

  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Two shapes on one route:
  //   multipart/form-data -> PREVIEW. Parse + validate, write NOTHING.
  //   application/json     -> COMMIT. Everything re-validated below.
  // XLSX is binary, so parsing lives server-side rather than shipping a
  // spreadsheet library to the browser for an owner-only, occasional action.
  const contentType = req.headers.get("content-type") ?? "";
  const isPreview = contentType.includes("multipart/form-data");

  // Bulk writes across a whole workspace: cheap to fire, expensive to absorb.
  // Previews write nothing, so they get their own, looser bucket and cannot
  // starve the commit that follows them.
  const limited = isPreview
    ? rateLimit(`bookings:import-preview:${ctx.workspace._id.toString()}`, {
        limit: 30,
        windowMs: 300_000,
      })
    : rateLimit(`bookings:import:${ctx.workspace._id.toString()}`, {
        limit: 10,
        windowMs: 300_000,
      });
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        seconds: Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000)),
      },
      { status: 429 }
    );
  }

  if (isPreview) {
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
      if (looksLikeXlsx(bytes)) {
        parsed = await parseXlsxToRows(Buffer.from(bytes));
      } else if (isProbablyText(bytes)) {
        parsed = parseCsv(decodeCsvBytes(bytes));
      } else {
        // Image/PDF/etc. renamed .csv: refuse rather than preview garbage.
        return NextResponse.json({ error: "unreadable_file" }, { status: 400 });
      }
    } catch {
      // A crafted or truncated upload is the caller's problem, not a 500.
      return NextResponse.json({ error: "unreadable_file" }, { status: 400 });
    }
    // Same cap the commit enforces: a preview that cannot be imported is not
    // worth serializing back to the browser and validating row by row.
    if (parsed.rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: "too_many_rows", count: parsed.rows.length, max: MAX_ROWS },
        { status: 400 }
      );
    }
    return NextResponse.json({ preview: true, headers: parsed.headers, rows: parsed.rows });
  }

  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const rawBody = await req.text().catch(() => "");
  if (Buffer.byteLength(rawBody) > MAX_COMMIT_BYTES) {
    return NextResponse.json({ error: "import_too_large" }, { status: 413 });
  }
  let json: ImportPayload & { background?: boolean; requestId?: string };
  try {
    json = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(json.rows) || json.rows.length === 0) {
    return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
  }
  if (json.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: "too_many_rows", count: json.rows.length, max: MAX_ROWS },
      { status: 400 }
    );
  }

  if (json.background) return startImportJob(ctx, json);
  await connectDB();
  const activeJob = await BookingImportJob.findOne({ workspaceId: ctx.workspace._id, active: true })
    .select({ _id: 1 })
    .lean();
  if (activeJob) {
    return NextResponse.json(
      { error: "import_active", jobId: activeJob._id.toString() },
      { status: 409 }
    );
  }
  return processImportRows(ctx, json);
}

async function processImportRows(
  ctx: ImportContext,
  json: ImportPayload,
  options: { preflightOnly?: boolean; job?: JobRun } = {}
) {
  await connectDB();

  const mainTeam = await Team.findOne({ workspaceId: ctx.workspace._id, isDefault: true })
    .select({ _id: 1 })
    .lean();
  if (!mainTeam) {
    return NextResponse.json({ error: "No default team for workspace" }, { status: 500 });
  }

  // The caller may direct the whole file at one team. A team id from a request
  // body is untrusted, so it is re-read scoped to the workspace — a foreign id
  // must never become a booking's teamId. Absent means the default team, which
  // is also what a single-team workspace always gets.
  let targetTeamId = mainTeam._id;
  if (json.teamId !== undefined && json.teamId !== null) {
    const team =
      typeof json.teamId === "string" && mongoose.isValidObjectId(json.teamId)
        ? await Team.findOne({ _id: json.teamId, workspaceId: ctx.workspace._id })
            .select({ _id: 1 })
            .lean()
        : null;
    if (!team) {
      return NextResponse.json({ error: "invalid_team" }, { status: 400 });
    }
    targetTeamId = team._id;
  }

  const created: number[] = [];
  const updated: number[] = [];
  let importedShifts = 0;
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

  // Booking-currency FX is resolved once per distinct currency in the file —
  // never once per row — and entirely before any transaction opens, so a
  // slow/failed upstream fetch never holds a Mongo session open. Reads the
  // raw cell rather than the (not-yet-parsed) row so this only needs one pass.
  const rowCurrencies = new Set<string>();
  for (const raw of json.rows as Record<string, unknown>[]) {
    const c =
      typeof raw.currency === "string" && raw.currency.trim()
        ? raw.currency.trim().toUpperCase()
        : defaultCurrency.toUpperCase();
    rowCurrencies.add(c);
  }
  const freezeByCurrency = new Map<string, { rate: number; target: string } | null>();
  await Promise.all(
    [...rowCurrencies].map(async (currency) => {
      freezeByCurrency.set(currency, await resolveFxFreeze(currency, defaultCurrency));
    })
  );

  // Rows sharing a booking_id are ONE multi-session booking. Grouping is what
  // makes the exporter's one-row-per-session output round-trip instead of
  // fanning out into N separate bookings. Rows without a booking_id keep the
  // original one-row-one-booking behaviour.
  const groups = groupImportRows(json.rows as Record<string, unknown>[]);
  const markItem = async (
    groupIndex: number,
    outcome: JobOutcome,
    session?: mongoose.ClientSession
  ) => {
    if (!options.job) return;
    const marked = await BookingImportJobItem.updateOne(
      {
        workspaceId: ctx.workspace._id,
        jobId: options.job.id,
        groupIndex,
        status: "pending",
        leaseToken: options.job.token,
      },
      { $set: { status: "done", outcome } },
      { session }
    );
    if (marked.matchedCount !== 1) throw new Error("import_job_claim_lost");
  };

  // Pre-flight: does this file look like one already imported? Runs before any
  // write so the answer can be "ask the owner" rather than a half-applied file.
  // Deliberately workspace-wide, not scoped to the chosen team: importing the
  // same event for a second team is legitimate, but the owner should be told it
  // already exists elsewhere and on which team.
  if (!json.confirmDuplicates) {
    const duplicates: DuplicateWarning[] = [];
    const candidates: { index: number; title: string; startAt: Date }[] = [];
    for (const group of groups) {
      const first = group.rows[0] as Record<string, unknown>;
      const title = typeof first.title === "string" ? first.title.trim() : "";
      const startRaw = first.startAt;
      const startAt = typeof startRaw === "string" ? new Date(startRaw) : null;
      if (!title || !startAt || Number.isNaN(startAt.getTime())) continue;
      // An explicit booking_id is an update, which is never a duplicate.
      if (group.bookingId && /^[a-f0-9]{24}$/i.test(group.bookingId)) continue;

      candidates.push({ index: group.rowNumbers[0] - 1, title, startAt });
    }
    const matches = candidates.length
      ? await Booking.find({
        workspaceId: ctx.workspace._id,
        $or: candidates.map(({ title, startAt }) => ({ firstSessionStart: startAt, title })),
      })
        .select({ _id: 1, teamId: 1, title: 1, firstSessionStart: 1 })
        .lean()
      : [];
    const matchByKey = new Map(matches.map((match) => [`${match.title}\0${match.firstSessionStart?.toISOString()}`, match]));
    const teamIds = [...new Set(matches.map((match) => match.teamId?.toString()).filter((id): id is string => Boolean(id)))];
    const teams = teamIds.length
      ? await Team.find({ _id: { $in: teamIds }, workspaceId: ctx.workspace._id }).select({ name: 1 }).lean()
      : [];
    const teamNameById = new Map(teams.map((team) => [team._id.toString(), team.name]));
    for (const candidate of candidates) {
      const match = matchByKey.get(`${candidate.title}\0${candidate.startAt.toISOString()}`);
      if (!match) continue;
      duplicates.push({
        index: candidate.index,
        title: candidate.title,
        teamName: match.teamId ? teamNameById.get(match.teamId.toString()) ?? null : null,
      });
    }

    if (duplicates.length > 0) {
      return NextResponse.json({ needsConfirmation: true, duplicates } satisfies DuplicateCheck);
    }
  }

  if (options.preflightOnly) return NextResponse.json({ ready: true, totalGroups: groups.length });

  const processGroup = async (group: ImportGroup, groupIndex: number) => {
    if (options.job?.doneIndices.has(groupIndex)) return;
    // Errors are reported against the group's first source row.
    const i = group.rowNumbers[0] - 1;
    const raw: Record<string, unknown> = group.rows[0] as Record<string, unknown>;
    const failGroup = async (error: ImportErrorEntry) => {
      await markItem(groupIndex, { skipped: group.rows.length, error });
      errors.push(error);
      skippedRows += group.rows.length;
    };

    if (group.error === "too_many_sessions") {
      await failGroup({
        index: i,
        row: raw,
        field: "sessionIndex",
        kind: "validation",
        message: `A booking cannot have more than ${MAX_SESSIONS_PER_BOOKING} sessions.`,
      });
      return;
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
      await failGroup(rowError);
      return;
    }

    // Booking-level fields come from the group's first row; later rows in a
    // group contribute only their session.
    const row: BookingImportRowInput = parsedRows[0];

    // A booking_id in the file is a hint, never authority. Re-read it scoped to
    // the caller's workspace so a foreign (or bogus) id can never be written
    // to. Both cases answer the same way, so this is not an existence oracle.
    let existingBooking:
      | {
          _id: mongoose.Types.ObjectId;
          clientId: mongoose.Types.ObjectId;
          amount?: { total?: number; deposit?: number } | null;
        }
      | null = null;
    // A 24-hex booking_id addresses an existing booking; anything else is a
    // grouping key the author invented, which turns its rows into ONE new
    // multi-session booking. Deliberately stricter than isValidObjectId, which
    // also accepts any 12-character string — "wedding-2026" would be read as an
    // id under that test. A mistyped real id is still 24-hex, so it still fails
    // loudly instead of quietly creating a duplicate.
    if (group.bookingId && /^[a-f0-9]{24}$/i.test(group.bookingId)) {
      existingBooking = await Booking.findOne({
        _id: group.bookingId,
        workspaceId: ctx.workspace._id,
        // Drafts are promoted only by the approve flow, never by import.
        status: { $ne: "draft" },
      })
        // amount comes along so an edit to it can be refused rather than
        // silently dropped by the $set below.
        .select({ _id: 1, clientId: 1, amount: 1 })
        .lean();

      if (!existingBooking) {
        await failGroup({
          index: i,
          row: raw,
          field: "bookingId",
          kind: "lookup",
          message: "booking_not_found_in_workspace",
        });
        return;
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
      await failGroup({
        index: i,
        row: raw,
        field: "endAt",
        kind: "validation",
        message: "Session must start and end on the same day in the workspace timezone.",
      });
      return;
    }

    const firstSessionStart = new Date(
      Math.min(...sessions.map((s) => s.startAt.getTime()))
    );
    const lastSessionEnd = new Date(
      Math.max(...sessions.map((s) => s.endAt.getTime()))
    );

    // A row that looks already-imported is surfaced for confirmation before
    // anything is written (see the pre-flight pass above), never skipped here:
    // the owner may be importing the same event for a second team on purpose.

    // Mirrors the PATCH invariant: completing requires the deposit plus every
    // paid payment to settle the total, so a sheet cannot create a state the
    // app itself would refuse.
    if (
      row.status === "completed" &&
      !isCompletionEligible(row.payments ?? [], {
        total: row.amountTotal ?? 0,
        deposit: row.amountDeposit ?? 0,
      })
    ) {
      await failGroup({
        index: i,
        row: raw,
        field: "status",
        kind: "validation",
        message: "completed_booking_not_paid",
      });
      return;
    }

    // ── update path ────────────────────────────────────────────────────────
    // clientId/clientName are deliberately NOT reassigned here: moving a
    // booking between clients rewrites the transaction ledger, which stays a
    // drawer operation. Amounts are likewise left alone — they are ledger-
    // linked, so a spreadsheet must not be able to desynchronise them.
    if (existingBooking) {
      // Amounts are ledger-linked: changing one has to reproject transactions
      // and re-check payment invariants, which import does not do. Refusing is
      // honest; reporting `updated` while dropping the edit is not.
      const storedTotal = existingBooking.amount?.total ?? 0;
      const storedDeposit = existingBooking.amount?.deposit ?? 0;
      const wantsTotal = row.amountTotal ?? storedTotal;
      const wantsDeposit = row.amountDeposit ?? storedDeposit;
      if (wantsTotal !== storedTotal || wantsDeposit !== storedDeposit) {
        await failGroup({
          index: i,
          row: raw,
          field: "amountTotal",
          kind: "validation",
          message:
            "Amounts cannot be changed by import because they are linked to the payment ledger. Edit them on the booking instead.",
        });
        return;
      }

      const updateSession = await mongoose.startSession();
      try {
        // One transaction per booking group, same as the create path: a booking
        // must never end up mutated without its audit entry.
        await updateSession.withTransaction(async () => {
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
            },
            { session: updateSession }
          );
          // Stamp bookedAt once if still unset.
          await Booking.updateOne(
            { _id: existingBooking._id, workspaceId: ctx.workspace._id, bookedAt: null },
            { $set: { bookedAt: new Date() } },
            { session: updateSession }
          );
          await ActivityLog.create(
            [
              {
                workspaceId: ctx.workspace._id,
                actorUserId: ctx.userId,
                entity: "booking",
                entityId: existingBooking._id,
                action: "updated",
                meta: { via: "import" },
              },
            ],
            { session: updateSession }
          );
          await markItem(groupIndex, { updated: 1, shifts: sessions.length }, updateSession);
        });
        updated.push(i);
        importedShifts += sessions.length;
      } catch (err) {
        if (err instanceof Error && err.message === "import_job_claim_lost") throw err;
        console.error("[bookings.import] group update failed", { index: i, err });
        await failGroup({
          index: i,
          row: raw,
          kind: "server",
          message: err instanceof Error ? err.message.slice(0, 200) : "Unknown server error",
        });
      } finally {
        await updateSession.endSession();
      }
      return;
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
        let clientCreatedInSession = false;

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
              clientCreatedInSession = true;
            } else if (row.clientPhone && !client.phone) {
              // Fill a gap, never overwrite: a stale sheet must not clobber a
              // number the owner maintains in the CRM.
              await Client.updateOne(
                { _id: client._id, workspaceId: ctx.workspace._id },
                { $set: { phone: row.clientPhone } },
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
          clientCreatedInSession = true;
          // No email — cannot be cached for deduplication; no-op.
        }

        const rowCurrency = row.currency ?? defaultCurrency;
        const freeze = freezeByCurrency.get(rowCurrency.toUpperCase()) ?? null;
        const now = new Date();
        const depositFreeze = (row.amountDeposit ?? 0) > 0 ? freeze : null;

        const [booking] = await Booking.create(
          [
            {
              workspaceId: ctx.workspace._id,
              teamId: targetTeamId,
              clientId,
              clientName,
              title: row.title,
              eventType: row.eventType ?? "other",
              status: row.status ?? "booked",
              bookedAt: now,
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
                currency: rowCurrency,
                fxRate: depositFreeze?.rate ?? null,
                fxTarget: depositFreeze?.target ?? null,
                fxAt: depositFreeze ? now : null,
              },
              // normalizePayments also fills createdAt (required by the schema;
              // an exported payment always carries one, a hand-authored row
              // need not) and applies the same freeze rule as a manual create.
              payments: normalizePayments(row.payments ?? [], now, freeze),
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

        // recordBookingForClient projects only the deposit. Paid payment lines
        // are a separate projection, so without this the booking would show
        // payments the client's totalSpent does not account for.
        if (booking.payments?.length) {
          await syncBookingPaymentsForClient({
            workspaceId: ctx.workspace._id,
            clientId: new mongoose.Types.ObjectId(clientId),
            booking: {
              _id: booking._id,
              payments: booking.payments,
              amount: booking.amount!,
              teamId: booking.teamId ?? null,
            },
            session,
          });
        }

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
          clientCreatedInSession,
        });
        await markItem(groupIndex, { created: 1, shifts: sessions.length }, session);
      });

      // Only populate the cache after the transaction has been committed.
      // If the transaction aborted, committedClient remains null and the
      // email slot stays empty so a retry can create the client afresh.
      if (committedClient && row.clientEmail) {
        clientIdByEmail.set(row.clientEmail, committedClient);
      }

      created.push(i);
      importedShifts += sessions.length;
    } catch (err) {
      if (err instanceof Error && err.message === "import_job_claim_lost") throw err;
      console.error("[bookings.import] row transaction failed", { index: i, err });
      await failGroup({
        index: i,
        row: raw,
        kind: err instanceof Error && err.message === "client_not_found_in_workspace"
          ? "lookup"
          : "server",
        message: err instanceof Error ? err.message.slice(0, 200) : "Unknown server error",
      });
    } finally {
      await session.endSession();
    }
  };

  // A transaction changes its client's journal and summary. Run independent
  // clients together, while keeping groups for the same client in order so
  // email deduplication and client totals remain correct.
  const MAX_CONCURRENT_GROUPS = 8;
  let batch: { group: ImportGroup; groupIndex: number }[] = [];
  const clientKeys = new Set<string>();
  const flush = async () => {
    await Promise.all(batch.map(({ group, groupIndex }) => processGroup(group, groupIndex)));
    batch = [];
    clientKeys.clear();
  };
  for (const [groupIndex, group] of groups.entries()) {
    const first = group.rows[0];
    const clientId = typeof first.clientId === "string" ? first.clientId.trim() : "";
    const email = typeof first.clientEmail === "string" ? first.clientEmail.trim().toLowerCase() : "";
    const keys = [clientId ? `id:${clientId}` : "", email ? `email:${email}` : ""].filter(Boolean);
    if (batch.length >= MAX_CONCURRENT_GROUPS || keys.some((key) => clientKeys.has(key))) await flush();
    batch.push({ group, groupIndex });
    for (const key of keys) clientKeys.add(key);
  }
  if (batch.length) await flush();
  errors.sort((a, b) => a.index - b.index);

  if (!options.job && created.length + updated.length > 0) {
    emitDataChanged(ctx.workspace._id.toString(), { type: "bookings.imported" });
  }

  const skipped = skippedRows;
  const validationErrors = errors.filter((e) => e.kind === "validation").length;
  const serverErrors = errors.filter((e) => e.kind === "server").length;

  return NextResponse.json(
    {
      created: created.length,
      updated: updated.length,
      shifts: importedShifts,
      skipped,
      validationErrors,
      serverErrors,
      errors,
    } satisfies ImportResult,
    { status: errors.length === json.rows.length ? 422 : 200 }
  );
}

async function startImportJob(
  ctx: ImportContext,
  json: ImportPayload & { requestId?: string }
) {
  if (typeof json.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(json.requestId)) {
    return NextResponse.json({ error: "invalid_request_id" }, { status: 400 });
  }
  await connectDB();
  await Promise.all([BookingImportJob.init(), BookingImportJobItem.init()]);
  const workspaceId = ctx.workspace._id;
  const existing = await BookingImportJob.findOne({ workspaceId, requestId: json.requestId })
    .select({ _id: 1 })
    .lean();
  if (existing) return NextResponse.json({ jobId: existing._id.toString() }, { status: 202 });

  const active = await BookingImportJob.findOne({ workspaceId, active: true })
    .select({ _id: 1 })
    .lean();
  if (active) {
    return NextResponse.json({ error: "import_active", jobId: active._id.toString() }, { status: 409 });
  }

  const preflight = await processImportRows(ctx, json, { preflightOnly: true });
  const preflightBody = await preflight.clone().json();
  if (preflight.status !== 200 || !preflightBody.ready) return preflight;

  const jobId = new mongoose.Types.ObjectId();
  const groups = groupImportRows(json.rows);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await BookingImportJob.create(
        [{
          _id: jobId,
          workspaceId,
          requestId: json.requestId,
          actorUserId: ctx.userId,
          rows: json.rows,
          teamId: json.teamId ?? null,
          currency: ctx.workspace.currency ?? "PHP",
          timezone: ctx.workspace.timezone ?? FALLBACK_TZ,
          totalGroups: groups.length,
          status: "queued",
          active: true,
          expiresAt,
        }],
        { session }
      );
      await BookingImportJobItem.insertMany(
        groups.map((_, groupIndex) => ({
          workspaceId,
          jobId,
          groupIndex,
          status: "pending",
          expiresAt,
        })),
        { session }
      );
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const prior = await BookingImportJob.findOne({ workspaceId, requestId: json.requestId })
        .select({ _id: 1 })
        .lean();
      if (prior) return NextResponse.json({ jobId: prior._id.toString() }, { status: 202 });
      const running = await BookingImportJob.findOne({ workspaceId, active: true })
        .select({ _id: 1 })
        .lean();
      if (running) {
        return NextResponse.json({ error: "import_active", jobId: running._id.toString() }, { status: 409 });
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  after(() => processImportJob(jobId));
  return NextResponse.json({ jobId: jobId.toString() }, { status: 202 });
}

async function getImportJobStatus(ctx: ImportContext, params: URLSearchParams) {
  await connectDB();
  const workspaceId = ctx.workspace._id;
  const jobId = params.get("jobId");
  const requestId = params.get("requestId");
  let job;
  if (jobId) {
    if (!/^[a-f0-9]{24}$/i.test(jobId)) {
      return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    }
    job = await BookingImportJob.findOne({ _id: jobId, workspaceId }).select({ rows: 0 }).lean();
  } else if (requestId) {
    job = await BookingImportJob.findOne({ requestId, workspaceId }).select({ rows: 0 }).lean();
  } else {
    job = await BookingImportJob.findOne({ workspaceId, active: true })
      .select({ rows: 0 })
      .sort({ createdAt: -1 })
      .lean();
  }
  if (!job) {
    return params.has("latest")
      ? NextResponse.json({ job: null }, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  const doneGroups = await BookingImportJobItem.countDocuments({
    workspaceId,
    jobId: job._id,
    status: "done",
  });
  if (job.active && (job.status === "queued" || !job.leaseUntil || job.leaseUntil < new Date())) {
    after(() => processImportJob(job._id));
  }
  return NextResponse.json(
    {
      job: {
        jobId: job._id.toString(),
        status: job.status,
        doneGroups,
        totalGroups: job.totalGroups,
        result: job.result,
        lastError: job.lastError,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function processImportJob(jobId: mongoose.Types.ObjectId) {
  await connectDB();
  const now = new Date();
  const token = randomUUID();
  const claimed = await BookingImportJob.findOneAndUpdate(
    {
      _id: jobId,
      active: true,
      $or: [
        { status: "queued" },
        { status: "running", leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "running",
        leaseToken: token,
        leaseUntil: new Date(now.getTime() + JOB_LEASE_MS),
        lastError: null,
      },
      $inc: { attempts: 1 },
    },
    { new: true }
  ).lean();
  if (!claimed) return;

  try {
    await BookingImportJobItem.updateMany(
      { workspaceId: claimed.workspaceId, jobId, status: "pending" },
      { $set: { leaseToken: token } }
    );
    const done = await BookingImportJobItem.find({
      workspaceId: claimed.workspaceId,
      jobId,
      status: "done",
    }).select({ groupIndex: 1 }).lean();
    const ctx: ImportContext = {
      userId: claimed.actorUserId,
      workspace: {
        _id: claimed.workspaceId,
        currency: claimed.currency,
        timezone: claimed.timezone,
      },
    };
    await processImportRows(
      ctx,
      { rows: claimed.rows as Record<string, unknown>[], teamId: claimed.teamId ?? undefined, confirmDuplicates: true },
      { job: { id: jobId, token, doneIndices: new Set(done.map((item) => item.groupIndex)) } }
    );

    const items = await BookingImportJobItem.find({ workspaceId: claimed.workspaceId, jobId })
      .select({ status: 1, outcome: 1 })
      .lean();
    if (items.length !== claimed.totalGroups || items.some((item) => item.status !== "done")) {
      throw new Error("import_job_incomplete");
    }
    const result: ImportResult = {
      created: 0,
      updated: 0,
      shifts: 0,
      skipped: 0,
      validationErrors: 0,
      serverErrors: 0,
      errors: [],
    };
    for (const item of items) {
      const outcome = item.outcome as JobOutcome;
      result.created += outcome.created ?? 0;
      result.updated += outcome.updated ?? 0;
      result.shifts += outcome.shifts ?? 0;
      result.skipped += outcome.skipped ?? 0;
      if (outcome.error) {
        result.errors.push(outcome.error);
        if (outcome.error.kind === "validation") result.validationErrors++;
        if (outcome.error.kind === "server") result.serverErrors++;
      }
    }
    result.errors.sort((a, b) => a.index - b.index);
    const completed = await BookingImportJob.updateOne(
      { _id: jobId, workspaceId: claimed.workspaceId, leaseToken: token, status: "running" },
      {
        $set: {
          status: "completed",
          active: false,
          result,
          completedAt: new Date(),
          leaseUntil: null,
        },
      }
    );
    if (completed.matchedCount === 1 && result.created + result.updated > 0) {
      emitDataChanged(claimed.workspaceId.toString(), { type: "bookings.imported" });
    }
  } catch (error) {
    console.error("[bookings.import] background job failed", {
      jobId: jobId.toString(),
      message: error instanceof Error ? error.message : "Unknown error",
    });
    await BookingImportJob.updateOne(
      { _id: jobId, workspaceId: claimed.workspaceId, leaseToken: token, status: "running" },
      {
        $set: {
          status: claimed.attempts >= 3 ? "failed" : "queued",
          active: claimed.attempts < 3,
          lastError: "background_failed",
          leaseUntil: null,
        },
      }
    );
  }
}
