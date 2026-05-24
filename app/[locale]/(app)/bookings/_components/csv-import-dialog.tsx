"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircleIcon,
  FileTextIcon,
  Loader2Icon,
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
import { parseCsv } from "@/lib/utils/csv-parse";
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

const HEADER_SPEC = [
  { name: "clientName", required: true, note: "Full name of the client" },
  { name: "clientEmail", required: false, note: "Used to deduplicate existing clients" },
  { name: "startAt", required: true, note: "ISO 8601 — e.g. 2026-06-15T09:00" },
  { name: "endAt", required: false, note: "Defaults to startAt if omitted" },
  { name: "title", required: false, note: "Booking title" },
  { name: "eventType", required: false, note: "wedding, corporate, portrait, etc." },
  { name: "status", required: false, note: "inquiry, quoted, booked, completed, cancelled" },
  { name: "amountTotal", required: false, note: "Total booking amount" },
  { name: "amountDeposit", required: false, note: "Deposit amount" },
  { name: "currency", required: false, note: "Defaults to workspace currency" },
  { name: "locationAddress", required: false, note: "Venue or location text" },
  { name: "notes", required: false, note: "Internal notes" },
] as const;

const TEMPLATE_HEADERS = HEADER_SPEC.map((h) => h.name);

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
];

function downloadTemplate() {
  const comment = "# Required: clientName, startAt. clientEmail optional but used to dedupe.";
  const csv = [
    comment,
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
  const tCols = useTranslations("app.bookings.import.columns");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  const validRows = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        setParseError(t("parseError"));
        return;
      }
      setFileName(file.name);
      setRows([]);
      setImportResult(null);
      setParseError(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const { rows: csvRows } = parseCsv(text);
          const parsed: ParsedRow[] = csvRows.map((raw, i) => {
            const result = bookingImportRowSchema.safeParse({
              ...raw,
              amountTotal: raw.amountTotal || undefined,
              amountDeposit: raw.amountDeposit || undefined,
              clientEmail: raw.clientEmail || null,
            });
            if (result.success) {
              return {
                index: i,
                raw,
                valid: true,
                error: null,
                title: raw.title ?? "",
                clientName: raw.clientName ?? "",
                startAt: raw.startAt ?? "",
              };
            }
            return {
              index: i,
              raw,
              valid: false,
              error: result.error.errors[0]?.message ?? "Invalid row",
              title: raw.title ?? "",
              clientName: raw.clientName ?? "",
              startAt: raw.startAt ?? "",
            };
          });
          setRows(parsed);
        } catch {
          setParseError(t("parseError"));
        }
      };
      reader.readAsText(file);
    },
    [t]
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

  async function runImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportResult(null);
    try {
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
      const data: ImportResult = await res.json();
      setImportResult(data);

      if (data.created > 0) {
        toast.success(t("success", { count: data.created }));
        startTransition(() => router.refresh());
      }
      if (data.errors.length > 0) {
        setShowResultsDialog(true);
        if (data.created === 0) {
          toast.error("Import failed — see details");
        }
      }
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

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
                  <span>Column</span>
                  <span />
                  <span>Notes</span>
                </div>
                {HEADER_SPEC.map((h) => (
                  <div
                    key={h.name}
                    className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-border px-3 py-1.5 text-xs last:border-0"
                  >
                    <span className="font-mono text-foreground">{h.name}</span>
                    <span className="px-2">
                      {h.required ? (
                        <Badge variant="default" className="text-[10px] leading-none">
                          required
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] leading-none">
                          optional
                        </Badge>
                      )}
                    </span>
                    <span className="text-muted-foreground">{h.note}</span>
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
                  accept=".csv,text/csv"
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
              <FileTextIcon className="mr-1 inline size-3" />
              {t("template")}
            </button>

            {hasRows ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">
                    {t("preview", { total: rows.length })}
                  </span>
                  {validRows.length > 0 ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      {t("validCount", { count: validRows.length })}
                    </span>
                  ) : null}
                  {invalidRows.length > 0 ? (
                    <span className="text-xs text-destructive">
                      {t("invalidCount", { count: invalidRows.length })}
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">{fileName}</span>
                </div>

                <div className="max-h-64 overflow-auto border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted text-muted-foreground">
                      <tr>
                        <th className="w-8 border-b border-border px-2 py-1.5 text-left font-medium">
                          {tCols("row")}
                        </th>
                        <th className="w-5 border-b border-border px-1 py-1.5" />
                        <th className="border-b border-border px-2 py-1.5 text-left font-medium">
                          {tCols("title")}
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-left font-medium">
                          {tCols("client")}
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-left font-medium">
                          {tCols("start")}
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-left font-medium text-destructive">
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
                              <CheckCircleIcon className="size-3.5 text-emerald-500" />
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
              {done ? "Close" : "Cancel"}
            </Button>

            {hasRows && !done ? (
              validRows.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={runImport}
                  disabled={importing}
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  {importing ? <Loader2Icon className="size-4 animate-spin" /> : null}
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
                    View {importResult.errors.length} error(s)
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
          skipped={importResult.skipped}
        />
      ) : null}
    </>
  );
}