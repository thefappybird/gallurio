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
import { parseCsv } from "@/lib/utils/csv-parse";
import { bookingImportRowSchema } from "@/lib/validators/booking";
import type { ImportResult } from "@/app/api/bookings/import/route";
import { cn } from "@/lib/utils";

type ParsedRow = {
  index: number;
  raw: Record<string, string>;
  valid: boolean;
  error: string | null;
  // display fields pulled from raw for the preview table
  title: string;
  clientName: string;
  startAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultCurrency: string;
};

const TEMPLATE_HEADERS = [
  "title",
  "clientName",
  "clientEmail",
  "startAt",
  "endAt",
  "eventType",
  "status",
  "locationAddress",
  "amountTotal",
  "amountDeposit",
  "currency",
  "notes",
];

const SAMPLE_ROW = [
  "Smith Wedding",
  "Jane Smith",
  "jane@example.com",
  "2026-06-15T09:00",
  "2026-06-15T18:00",
  "wedding",
  "booked",
  "Grand Ballroom, Manila",
  "50000",
  "10000",
  "PHP",
  "Ceremony + reception",
];

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS.join(","), SAMPLE_ROW.map(quoteField).join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bookings-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function quoteField(v: string) {
  if (/[,"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
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
              // Coerce empty strings to undefined for optional numeric fields.
              amountTotal: raw.amountTotal || undefined,
              amountDeposit: raw.amountDeposit || undefined,
              // clientEmail: empty string → null (schema handles it)
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
        const msg =
          data.errors.length > 0
            ? t("partialSuccess", { count: data.created, failed: data.errors.length })
            : t("success", { count: data.created });
        toast.success(msg);
        startTransition(() => router.refresh());
      }
      if (data.created === 0) {
        toast.error("No bookings were imported.");
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
    onClose();
  }

  const hasRows = rows.length > 0;
  const done = importResult !== null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <div className="border-b border-border px-4 py-3">
          <DialogTitle>{t("title")}</DialogTitle>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {/* File drop zone (always visible until we have rows) */}
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

          {/* Parse error */}
          {parseError ? (
            <p className="text-sm text-destructive">{parseError}</p>
          ) : null}

          {/* Template download — always visible */}
          <button
            type="button"
            onClick={downloadTemplate}
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <FileTextIcon className="mr-1 inline size-3" />
            {t("template")}
          </button>

          {/* Preview table */}
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

              {/* Server-side errors after import (partial failure) */}
              {importResult && importResult.errors.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-destructive">
                    {importResult.errors.length} row(s) failed on the server:
                  </p>
                  <ul className="flex flex-col gap-0.5 text-xs text-destructive">
                    {importResult.errors.map((e) => (
                      <li key={e.index}>
                        Row {e.index + 1}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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

          {done ? (
            <span className="text-xs text-muted-foreground">
              {importResult!.errors.length === 0
                ? t("success", { count: importResult!.created })
                : t("partialSuccess", {
                    count: importResult!.created,
                    failed: importResult!.errors.length,
                  })}
            </span>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
