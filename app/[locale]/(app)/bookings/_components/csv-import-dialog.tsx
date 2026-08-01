"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useGuardedAction } from "@/hooks/use-guarded-action";
import { useRouter } from "@/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
import { toast } from "sonner";
import {
  CheckCircleIcon,
  FileTextIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseCsv, stripFormulaGuard } from "@/lib/utils/csv-parse";
import { bookingImportRowSchema } from "@/lib/validators/booking";
import type { ImportResult } from "@/app/api/bookings/import/route";
import { ImportResultsDialog } from "./import-results-dialog";
import { cn } from "@/lib/utils";

type ParsedRow = {
  index: number;
  raw: Record<string, string>;
  valid: boolean;
  error: string | null;
  title: string;
  clientName: string;
  startAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultCurrency: string;
};

const HEADER_SPEC_KEYS = [
  { name: "clientName", required: true },
  { name: "clientEmail", required: false },
  { name: "startAt", required: true },
  { name: "endAt", required: false },
  { name: "title", required: true },
  { name: "eventType", required: false },
  { name: "status", required: false },
  { name: "amountTotal", required: false },
  { name: "amountDeposit", required: false },
  { name: "currency", required: false },
  { name: "locationAddress", required: false },
  { name: "notes", required: false },
  // Emitted by the exporter and read back on import. Undocumented until now,
  // which left the multi-session and update-in-place behaviour invisible.
  { name: "booking_id", required: false },
  { name: "session_index", required: false },
  { name: "clientId", required: false },
  { name: "clientPhone", required: false },
] as const;

// The downloadable template stays at the columns someone would hand-author: a
// new booking has no booking_id, and inventing one would look like a required
// field. The spec table above still explains them.
const TEMPLATE_HEADERS = HEADER_SPEC_KEYS.filter(
  (h) => !["booking_id", "session_index", "clientId"].includes(h.name)
).map((h) => h.name);

const SAMPLE_ROW = [
  "Jane Smith",
  "jane@example.com",
  "2026-06-15T09:00",
  "2026-06-15T18:00",
  "Smith Wedding",
  "wedding",
  "booked",
  "50000",
  "10000",
  "PHP",
  "Grand Ballroom, Manila",
  "Ceremony + reception",
  "+63 917 555 0142",
];

function downloadTemplate() {
  const csv = [
    // title was required all along but went unmentioned here.
    "# Required: title, clientName, startAt. clientEmail is optional and used to match an existing client.",
    "# Exporting adds booking_id and session_index. Keep them to update a booking in place instead of",
    "# creating a copy; rows sharing one booking_id become a single multi-session booking.",
    TEMPLATE_HEADERS.join(","),
    SAMPLE_ROW.map(quoteField).join(","),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bookings-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function quoteField(v: string) {
  if (/[,"\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

export function CsvImportDialog({ open, onClose, defaultCurrency }: Props) {
  const t = useTranslations("app.bookings.import");
  const tDialog = useTranslations("app.bookings.import.dialog");
  const errMsg = useActionError();
  const tCols = useTranslations("app.bookings.import.columns");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  // Rows sharing a booking_id are ONE booking, and the route rebuilds its
  // sessions from whatever rows arrive. Importing the good half of a group
  // would therefore delete the sessions belonging to the bad half, so a group
  // is all-or-nothing.
  const blockedGroups = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) {
      const id = r.raw.bookingId?.trim();
      if (!r.valid && id) ids.add(id);
    }
    return ids;
  }, [rows]);

  const validRows = useMemo(
    () => rows.filter((r) => r.valid && !blockedGroups.has(r.raw.bookingId?.trim() ?? "")),
    [rows, blockedGroups]
  );
  const invalidRows = useMemo(
    () => rows.filter((r) => !r.valid || blockedGroups.has(r.raw.bookingId?.trim() ?? "")),
    [rows, blockedGroups]
  );

  const { loading: importing, trigger: triggerImport } = useGuardedAction(
    useCallback(async () => {
      if (validRows.length === 0) return;

      setImportResult(null);
      const payload = validRows.map((r) => ({
        ...r.raw,
        amountTotal: r.raw.amountTotal || undefined,
        amountDeposit: r.raw.amountDeposit || undefined,
        clientEmail: r.raw.clientEmail || null,
        currency: r.raw.currency || defaultCurrency,
      }));

      const res = await fetch("/api/bookings/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const body = await res.json().catch(() => null);
      // A rejected request (429, 403, 400) answers with {error}, not a result.
      // Committing that to state and reading .errors off it throws during the
      // next render and takes the page down with it.
      if (!res.ok || !body || !Array.isArray(body.errors)) {
        toast.error(errMsg(body?.error));
        return;
      }

      const data: ImportResult = body;
      setImportResult(data);

      const written = data.created + data.updated;
      if (written > 0) {
        toast.success(t("success", { count: written }));
        startTransition(() => router.refresh());
      }
      if (data.errors.length > 0) {
        setShowResultsDialog(true);
        if (written === 0) {
          toast.error(tDialog("failedWithDetails"));
        }
      }
    }, [validRows, defaultCurrency, t, tDialog, errMsg, router, startTransition]),
    {
      onError: () => {
        toast.error(tDialog("failedRetry"));
      },
    }
  );

  // Validate + shape parsed rows for the preview table. Shared by both paths so
  // a CSV and an XLSX produce an identical preview.
  const buildRows = useCallback((csvRows: Record<string, string>[]): ParsedRow[] => {
    return csvRows.map((rawIn, i) => {
      // Undo the exporter's anti-formula apostrophe before anything is shown or
      // sent, so the preview matches what the route will store. Stripping twice
      // is a no-op, so the route keeping its own guard costs nothing.
      const raw = Object.fromEntries(
        Object.entries(rawIn).map(([k, v]) => [k, typeof v === "string" ? stripFormulaGuard(v) : v])
      ) as Record<string, string>;
      const result = bookingImportRowSchema.safeParse({
        ...raw,
        amountTotal: raw.amountTotal || undefined,
        amountDeposit: raw.amountDeposit || undefined,
        clientEmail: raw.clientEmail || null,
      });
      return {
        index: i,
        raw,
        valid: result.success,
        error: result.success ? null : (result.error.errors[0]?.message ?? "Invalid row"),
        title: raw.title ?? "",
        clientName: raw.clientName ?? "",
        startAt: raw.startAt ?? "",
      };
    });
  }, []);

  const processFile = useCallback(
    (file: File) => {
      const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
      if (!isXlsx && !isCsv) {
        setParseError(t("parseError"));
        return;
      }
      setFileName(file.name);
      setRows([]);
      setImportResult(null);
      setParseError(null);

      // XLSX is binary, so it is parsed server-side rather than shipping a
      // spreadsheet library to the browser. CSV is text and stays local, which
      // keeps the common case a zero-round-trip preview.
      if (isXlsx) {
        const body = new FormData();
        body.append("file", file);
        void fetch("/api/bookings/import", { method: "POST", body })
          .then(async (res) => {
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.rows) {
              setParseError(t("parseError"));
              return;
            }
            setRows(buildRows(data.rows as Record<string, string>[]));
          })
          .catch(() => setParseError(t("parseError")));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          setRows(buildRows(parseCsv(text).rows));
        } catch {
          setParseError(t("parseError"));
        }
      };
      reader.readAsText(file);
    },
    [t, buildRows]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  function handleClose() {
    if (importing) return;
    setRows([]);
    setFileName(null);
    setParseError(null);
    setImportResult(null);
    setShowResultsDialog(false);
    onClose();
  }

  const hasRows = rows.length > 0;
  const done = importResult !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          showCloseButton
          className="flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl"
        >
          <div className="border-b border-border px-4 py-3">
            <DialogTitle>{t("title")}</DialogTitle>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            {!hasRows ? (
              <div className="border border-border">
                <div className="grid grid-cols-[1fr_auto_1fr] border-b border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <span>{tDialog("columnHeader")}</span>
                  <span />
                  <span>{tDialog("notesHeader")}</span>
                </div>
                {HEADER_SPEC_KEYS.map((h) => (
                  <div
                    key={h.name}
                    className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-border px-3 py-1.5 text-xs last:border-0"
                  >
                    <span className="font-mono text-foreground">{h.name}</span>
                    <span className="px-2">
                      {h.required ? (
                        <Badge variant="default" className="text-[10px] leading-none">
                          {tDialog("required")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] leading-none">
                          {tDialog("optional")}
                        </Badge>
                      )}
                    </span>
                    <span className="text-muted-foreground">{tDialog(`spec.${h.name}.note`)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {!hasRows ? (
              <div
                role="button"
                tabIndex={0}
                aria-label={t("dropzone")}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-colors",
                  dragging
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-border text-muted-foreground hover:border-brand hover:text-brand"
                )}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <UploadIcon className="size-8 opacity-60" />
                <p className="text-sm">{dragging ? t("dropzoneActive") : t("dropzone")}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={onInputChange}
                />
              </div>
            ) : null}

            {parseError ? (
              <p className="text-sm text-destructive">{parseError}</p>
            ) : null}

            <button
              type="button"
              onClick={downloadTemplate}
              className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <FileTextIcon className="me-1 inline size-3" />
              {t("template")}
            </button>

            {hasRows ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">
                    {t("preview", { total: rows.length })}
                  </span>
                  {validRows.length > 0 ? (
                    <span className="text-xs text-foreground">
                      {t("validCount", { count: validRows.length })}
                    </span>
                  ) : null}
                  {invalidRows.length > 0 ? (
                    <span className="text-xs text-destructive">
                      {t("invalidCount", { count: invalidRows.length })}
                    </span>
                  ) : null}
                  <span className="ms-auto text-xs text-muted-foreground">{fileName}</span>
                </div>

                <div className="max-h-64 overflow-auto border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted text-muted-foreground">
                      <tr>
                        <th className="w-8 border-b border-border px-2 py-1.5 text-start font-medium">
                          {tCols("row")}
                        </th>
                        <th className="w-5 border-b border-border px-1 py-1.5" />
                        <th className="border-b border-border px-2 py-1.5 text-start font-medium">
                          {tCols("title")}
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-start font-medium">
                          {tCols("client")}
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-start font-medium">
                          {tCols("start")}
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-start font-medium text-destructive">
                          {tCols("error")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.index}
                          className={cn(
                            "border-b border-border last:border-0",
                            row.valid ? "" : "bg-destructive/5"
                          )}
                        >
                          <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                            {row.index + 1}
                          </td>
                          <td className="px-1 py-1.5">
                            {row.valid ? (
                              <CheckCircleIcon className="size-3.5 text-foreground" />
                            ) : (
                              <XCircleIcon className="size-3.5 text-destructive" />
                            )}
                          </td>
                          <td className="max-w-32 truncate px-2 py-1.5">{row.title || "—"}</td>
                          <td className="max-w-28 truncate px-2 py-1.5">{row.clientName || "—"}</td>
                          <td className="px-2 py-1.5 tabular-nums">{row.startAt || "—"}</td>
                          <td className="px-2 py-1.5 text-destructive">{row.error ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={importing}>
              {done ? tDialog("close") : tDialog("cancel")}
            </Button>

            {hasRows && !done ? (
              validRows.length > 0 ? (
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  onClick={triggerImport}
                  loading={importing}
                >
                  {importing ? t("importing") : t("importButton", { count: validRows.length })}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">{t("noValidRows")}</span>
              )
            ) : null}

            {done && importResult ? (
              <div className="flex items-center gap-2">
                {importResult.errors.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResultsDialog(true)}
                  >
                    {tDialog("viewErrors", { n: importResult.errors.length })}
                  </Button>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {t("success", { count: importResult.created })}
                </span>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {importResult && importResult.errors.length > 0 ? (
        <ImportResultsDialog
          open={showResultsDialog}
          onClose={() => setShowResultsDialog(false)}
          errors={importResult.errors}
          created={importResult.created}
          updated={importResult.updated}
          skipped={importResult.skipped}
        />
      ) : null}
    </>
  );
}