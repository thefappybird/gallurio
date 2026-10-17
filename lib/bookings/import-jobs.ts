import { emitDataChanged } from "@/lib/sockets/emitDataChanged";
import { emitImportProgress } from "@/lib/sockets/emitImportProgress";
import { after, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, ActivityLog, Team, User } from "@/lib/db/models";
import { Notification } from "@/lib/db/models/Notification";
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
import { stripFormulaGuard } from "@/lib/utils/csv-parse";
import { sendNotification } from "@/lib/notifications/send";
import { resolveTeamRecipients } from "@/lib/notifications/recipients";
import type { NotificationType } from "@/lib/notifications/types";

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

export type ImportContext = {
  userId: string;
  workspace: {
    _id: mongoose.Types.ObjectId;
    currency?: string | null;
    timezone?: string | null;
  };
};

export type ImportPayload = {
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
  actorUserId: string;
  totalGroups: number;
};

export const JOB_LEASE_MS = 180_000;
const DATA_EMIT_INTERVAL_MS = 5_000;
export const MAX_IMPORT_ATTEMPTS = 3;

export async function processImportRows(
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
  let completedInRun = 0;
  const clientKeys = new Set<string>();
  let lastDataEmitAt = 0;
  let emittedWrites = 0;
  const flush = async () => {
    await Promise.all(batch.map(({ group, groupIndex }) => processGroup(group, groupIndex)));
    if (options.job) {
      // Fail open: any write refreshes other members mid-run, at most once per window.
      const writes = created.length + updated.length;
      if (writes > emittedWrites && Date.now() - lastDataEmitAt >= DATA_EMIT_INTERVAL_MS) {
        emitDataChanged(ctx.workspace._id.toString(), { type: "bookings.imported" });
        lastDataEmitAt = Date.now();
        emittedWrites = writes;
      }
      completedInRun += batch.filter(({ groupIndex }) => !options.job!.doneIndices.has(groupIndex)).length;
      emitImportProgress(options.job.actorUserId, {
        workspaceId: ctx.workspace._id.toString(),
        jobId: options.job.id.toString(),
        status: "running",
        doneGroups: options.job.doneIndices.size + completedInRun,
        totalGroups: options.job.totalGroups,
      });
    }
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

async function notifyImportOutcome(
  job: { _id: mongoose.Types.ObjectId; workspaceId: mongoose.Types.ObjectId;
    actorUserId: string; teamId?: mongoose.Types.ObjectId | null },
  type: Extract<NotificationType, `booking.import_${string}`>
) {
  const workspaceId = job.workspaceId;
  const owner = await User.findOne({
    workosUserId: job.actorUserId,
    memberships: { $elemMatch: { workspaceId, role: "owner" } },
  }).select({ workosUserId: 1, email: 1, name: 1 }).lean();
  const teamId = job.teamId ?? (await Team.findOne({ workspaceId, isDefault: true })
    .select({ _id: 1 }).lean())?._id;
  const teamRecipients = teamId ? await resolveTeamRecipients(workspaceId, teamId) : [];
  const existing = await Notification.find({
    workspaceId, entityId: job._id, type, entityType: "booking_import",
  }).select({ recipientWorkosUserId: 1 }).lean();
  const notified = new Set(existing.map((item) => item.recipientWorkosUserId));
  const base = {
    workspaceId: workspaceId.toString(), type, entityId: job._id.toString(),
    entityType: "booking_import" as const, triggeredByWorkosUserId: "system:booking-import",
    locale: "en", inAppOnly: true,
  };
  if (owner && !notified.has(owner.workosUserId)) {
    await sendNotification({ ...base, recipients: [{
      workosUserId: owner.workosUserId, email: owner.email, name: owner.name || undefined,
    }], vars: { importViewer: "owner" } });
  }
  const others = teamRecipients.filter((recipient) =>
    recipient.workosUserId !== job.actorUserId && !notified.has(recipient.workosUserId));
  if (others.length) {
    await sendNotification({ ...base, recipients: others, vars: { importViewer: "team" } });
  }
}

export async function deliverPendingImportNotification(jobId: mongoose.Types.ObjectId) {
  const job = await BookingImportJob.findOne({
    _id: jobId, notificationPending: true, active: false,
    status: { $in: ["completed", "failed"] },
  }).select({ workspaceId: 1, actorUserId: 1, teamId: 1, status: 1, result: 1 }).lean();
  if (!job) return;
  const type: Extract<NotificationType, `booking.import_${string}`> = job.status === "failed"
    ? "booking.import_failed"
    : (job.result as ImportResult | null)?.errors?.length
      ? "booking.import_partial" : "booking.import_completed";
  await notifyImportOutcome(job, type);
  await BookingImportJob.updateOne(
    { _id: jobId, workspaceId: job.workspaceId, notificationPending: true },
    { $set: { notificationPending: false } }
  );
}

export async function processImportJob(jobId: mongoose.Types.ObjectId) {
  await connectDB();
  const now = new Date();
  const token = randomUUID();
  const claimed = await BookingImportJob.findOneAndUpdate(
    {
      _id: jobId,
      active: true,
      attempts: { $lt: MAX_IMPORT_ATTEMPTS },
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

  const heartbeat = setInterval(() => {
    void BookingImportJob.updateOne(
      { _id: jobId, workspaceId: claimed.workspaceId, leaseToken: token, status: "running" },
      { $set: { leaseUntil: new Date(Date.now() + JOB_LEASE_MS) } }
    ).catch((error) => console.error("[bookings.import] lease heartbeat failed", error));
  }, 60_000);
  heartbeat.unref();

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
    emitImportProgress(claimed.actorUserId, {
      workspaceId: claimed.workspaceId.toString(), jobId: jobId.toString(), status: "running",
      doneGroups: done.length, totalGroups: claimed.totalGroups,
    });
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
      { job: { id: jobId, token, doneIndices: new Set(done.map((item) => item.groupIndex)),
        actorUserId: claimed.actorUserId, totalGroups: claimed.totalGroups } }
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
    if (completed.matchedCount === 1) {
      emitImportProgress(claimed.actorUserId, {
        workspaceId: claimed.workspaceId.toString(), jobId: jobId.toString(), status: "completed",
        doneGroups: claimed.totalGroups, totalGroups: claimed.totalGroups,
      });
      if (result.created + result.updated > 0) {
        emitDataChanged(claimed.workspaceId.toString(), { type: "bookings.imported" });
      }
      await deliverPendingImportNotification(jobId)
        .catch((error) => console.error("[bookings.import] terminal notification failed", error));
    }
  } catch (error) {
    console.error("[bookings.import] background job failed", {
      jobId: jobId.toString(),
      message: error instanceof Error ? error.message : "Unknown error",
    });
    const failed = claimed.attempts >= MAX_IMPORT_ATTEMPTS;
    const transitioned = await BookingImportJob.updateOne(
      { _id: jobId, workspaceId: claimed.workspaceId, leaseToken: token, status: "running" },
      {
        $set: {
          status: failed ? "failed" : "queued",
          active: !failed,
          lastError: "background_failed",
          leaseUntil: null,
        },
      }
    );
    if (transitioned.matchedCount === 1) {
      await announceNonCompletion(claimed, failed ? "failed" : "queued");
    }
  } finally {
    clearInterval(heartbeat);
  }
}

/** Progress + data-freshness + terminal notification after a failed/requeued transition. */
async function announceNonCompletion(
  job: { _id: mongoose.Types.ObjectId; workspaceId: mongoose.Types.ObjectId;
    actorUserId: string; totalGroups: number },
  status: "failed" | "queued"
) {
  const doneGroups = await BookingImportJobItem.countDocuments({
    workspaceId: job.workspaceId, jobId: job._id, status: "done",
  });
  emitImportProgress(job.actorUserId, {
    workspaceId: job.workspaceId.toString(), jobId: job._id.toString(),
    status, doneGroups, totalGroups: job.totalGroups,
  });
  // Groups already written stay written; do not try to narrow what changed.
  if (doneGroups > 0) emitDataChanged(job.workspaceId.toString(), { type: "bookings.imported" });
  if (status === "failed") {
    await deliverPendingImportNotification(job._id)
      .catch((notifyError) => console.error("[bookings.import] failure notification failed", notifyError));
  }
}

/** Recovery sweep: fail crash-looping jobs, resume one stuck job, retry one missed notification. */
export async function runImportRecoverySweep() {
  await connectDB();
  const now = new Date();
  const stuck = { active: true, $or: [{ status: "queued" }, { status: "running", leaseUntil: { $lte: now } }] };
  const exhausted = await BookingImportJob.find({ ...stuck, attempts: { $gte: MAX_IMPORT_ATTEMPTS } })
    .select({ _id: 1, workspaceId: 1, actorUserId: 1, totalGroups: 1 }).limit(5).lean();
  for (const job of exhausted) {
    const failed = await BookingImportJob.updateOne(
      { _id: job._id, workspaceId: job.workspaceId, ...stuck, attempts: { $gte: MAX_IMPORT_ATTEMPTS } },
      { $set: { status: "failed", active: false, lastError: "background_failed", leaseUntil: null } }
    );
    if (failed.matchedCount === 1) {
      await announceNonCompletion(job, "failed")
        .catch((error) => console.error("[bookings.import] exhausted job announce failed", error));
    }
  }
  const jobs = await BookingImportJob.find({ ...stuck, attempts: { $lt: MAX_IMPORT_ATTEMPTS } })
    .select({ _id: 1 }).sort({ createdAt: 1 }).limit(1).lean();
  for (const job of jobs) after(() => processImportJob(job._id));
  const pending = await BookingImportJob.findOne({ notificationPending: true, active: false })
    .select({ _id: 1 }).sort({ updatedAt: 1 }).lean();
  if (pending) after(() => deliverPendingImportNotification(pending._id));
  return { scheduled: jobs.length, notifications: pending ? 1 : 0, failed: exhausted.length };
}
