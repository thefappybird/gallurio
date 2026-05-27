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
  created: number;
  skipped: number;
};

function ErrorRow({ entry }: { entry: ImportErrorEntry }) {
  const t = useTranslations("app.bookings.import.results");
  const [expanded, setExpanded] = useState(false);
  const csvLine = entry.index + 2;

  const kindLabel: Record<ImportErrorEntry["kind"], string> = {
    validation: t("kindValidation"),
    lookup: t("kindLookup"),
    server: t("kindServer"),
  };

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronRightIcon className="size-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xs font-medium tabular-nums">{t("line", { csvLine })}</span>
            {entry.field ? (
              <span className="font-mono text-[10px] text-muted-foreground">{entry.field}</span>
            ) : null}
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wide",
                entry.kind === "validation" && "text-muted-foreground",
                entry.kind === "lookup" && "text-muted-foreground",
                entry.kind === "server" && "text-destructive"
              )}
            >
              {kindLabel[entry.kind]}
            </span>
          </div>
          <p className="text-xs text-foreground">{entry.message}</p>
        </div>
      </button>
      {expanded ? (
        <div className="border-t border-border bg-muted/30 px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("rawRow")}
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
            {JSON.stringify(entry.row, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export function ImportResultsDialog({ open, onClose, errors, created, skipped }: Props) {
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

        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <span>{t("summary", { created, skipped })}</span>
          <span>{t("hint")}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
