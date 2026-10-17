import { emitImportProgress } from "@/lib/sockets/emitImportProgress";
import { after, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { BookingImportJob } from "@/lib/db/models/BookingImportJob";
import { BookingImportJobItem } from "@/lib/db/models/BookingImportJobItem";
import { groupImportRows } from "@/lib/bookings/import-grouping";
import { FALLBACK_TZ } from "@/lib/bookings/session-validation";
import { rateLimit } from "@/lib/server/rateLimit";
import { parseCsv, decodeCsvBytes, isProbablyText } from "@/lib/utils/csv-parse";
import { serializeCsv } from "@/lib/utils/csv-serialize";
import { parseXlsxToRows, looksLikeXlsx, rowsToXlsxBuffer } from "@/lib/utils/xlsx";
import {
  IMPORT_TEMPLATE_HEADERS,
  buildImportTemplateRows,
} from "@/lib/bookings/import-template";
import { resolveWorkspaceTimezone } from "@/lib/utils/timezone";
import {
  processImportJob,
  processImportRows,
  type ImportContext,
  type ImportPayload,
} from "@/lib/bookings/import-jobs";

export type {
  ImportErrorEntry,
  DuplicateWarning,
  DuplicateCheck,
  ImportResult,
} from "@/lib/bookings/import-jobs";

export const runtime = "nodejs";

/** Hard byte cap applied BEFORE parsing — exceljs decompresses in memory. */
const MAX_UPLOAD_BYTES = 2_000_000;
/** Rows are what the user sees, so the cap is on rows, not bookings. */
const MAX_ROWS = 500;


const MAX_COMMIT_BYTES = 8_000_000;

/**
 * Downloadable import template, in the same two formats the importer accepts.
 *
 * Server-side because XLSX is a zip: generating it in the browser would mean
 * shipping a spreadsheet library for an owner-only, occasional click. The CSV
 * comes from here too so both formats can never disagree.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const ctx = await requireOrg();

  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
          notificationPending: true,
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
  emitImportProgress(ctx.userId, {
    workspaceId: workspaceId.toString(), jobId: jobId.toString(), status: "queued",
    doneGroups: 0, totalGroups: groups.length,
  });
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

