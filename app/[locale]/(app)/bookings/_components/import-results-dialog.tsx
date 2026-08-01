"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportErrorEntry } from "@/app/api/bookings/import/route";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  errors: ImportErrorEntry[];
  /**
   * Written/skipped counts. Absent when the same dialog explains a preview,
   * where nothing has been written and a summary would be a lie.
   */
  summary?: { created: number; updated: number; skipped: number };
};

/** Read a display value straight off the raw row — no shape assumptions. */
function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v.trim() : "";
}

function ErrorRow({ entry }: { entry: ImportErrorEntry }) {
  const t = useTranslations("app.bookings.import.results");
  const [expanded, setExpanded] = useState(false);
  const csvLine = entry.index + 2;

  const title = cell(entry.row, "title");
  const clientName = cell(entry.row, "clientName");
  const clientEmail = cell(entry.row, "clientEmail");
  const client = [clientName, clientEmail].filter(Boolean).join(" · ");

  const kindLabel: Record<ImportErrorEntry["kind"], string> = {
    validation: t("kindValidation"),
    lookup: t("kindLookup"),
    server: t("kindServer"),
  };

  return (
    <div className="border-b border-border last:border-0">
      {/* Identity first: which booking failed, then why. A line number alone
          means nothing against a 500-row file. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-muted/40 px-3 py-1.5">
        <span className="text-sm font-medium text-foreground">
          {title || t("untitled")}
        </span>
        {client ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">{client}</span>
        ) : null}
        <span className="ms-auto text-[10px] font-medium uppercase tracking-wide text-muted-foreground tabular-nums">
          {t("line", { csvLine })}
        </span>
      </div>

      <div className="px-3 py-2">
        <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2">
          {entry.field ? (
            <span className="font-mono text-[10px] text-muted-foreground">{entry.field}</span>
          ) : null}
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-wide",
              entry.kind === "server" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {kindLabel[entry.kind]}
          </span>
        </div>
        <p className="text-xs text-destructive">{entry.message}</p>

        <button
          type="button"
          className="mt-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDownIcon className="size-3" />
          ) : (
            <ChevronRightIcon className="size-3" />
          )}
          {t("rawRow")}
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-border bg-muted/30 px-3 py-2">
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
            {JSON.stringify(entry.row, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export function ImportResultsDialog({ open, onClose, errors, summary }: Props) {
  const t = useTranslations("app.bookings.import.results");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        showCloseButton
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-lg flex-col gap-0 p-0 sm:max-w-lg"
      >
        <div className="border-b border-border px-4 py-3">
          <DialogTitle>{t("title")}</DialogTitle>
        </div>

        <div className="flex-1 overflow-y-auto">
          {errors.map((e) => (
            <ErrorRow key={e.index} entry={e} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {summary ? <span>{t("summary", summary)}</span> : null}
          <span className={cn(!summary && "ms-auto")}>
            {summary ? t("hint") : t("previewHint")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
