"use client";

import { useTranslations } from "next-intl";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { nextSortDir } from "@/lib/tables/sort-next";
import type { SortDir, SortTable } from "@/lib/tables/sort";

/** Sortable `<th>` trigger: label + direction icon. Parent sets `aria-sort` on the th. */
export function SortHeaderButton({
  label,
  sorted,
  onClick,
}: {
  label: React.ReactNode;
  sorted: SortDir | false;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 whitespace-nowrap font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUpIcon className="size-3" aria-hidden="true" />
      ) : sorted === "desc" ? (
        <ArrowDownIcon className="size-3" aria-hidden="true" />
      ) : (
        <ArrowUpDownIcon className="size-3 opacity-40" aria-hidden="true" />
      )}
    </button>
  );
}

export function ariaSortFor(sorted: SortDir | false): "ascending" | "descending" | "none" {
  return sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";
}

/** Below-lg sort control (card lists have no headers): key select + direction toggle. */
export function MobileSortControl({
  table,
  options,
  sortKey,
  sortDir,
  onSortChange,
}: {
  table: SortTable;
  options: { key: string; label: string }[];
  sortKey: string;
  sortDir: SortDir;
  onSortChange: (key: string, dir: SortDir) => void;
}) {
  const t = useTranslations("common.tableSort");
  const labelFor = (key: string) =>
    options.find((o) => o.key === key)?.label ?? key;
  const dirLabel = sortDir === "asc" ? t("ascending") : t("descending");

  return (
    <div className="flex items-center gap-2 lg:hidden">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {t("sortBy")}
      </span>
      <Select<string>
        value={sortKey}
        onValueChange={(key) => {
          if (key && key !== sortKey) {
            onSortChange(key, nextSortDir(table, "", "asc", key));
          }
        }}
      >
        <SelectTrigger aria-label={t("sortBy")} className="h-11 min-w-0 flex-1">
          <SelectValue>{(v: string) => labelFor(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        className="size-11 shrink-0 p-0"
        aria-label={dirLabel}
        title={dirLabel}
        onClick={() => onSortChange(sortKey, sortDir === "asc" ? "desc" : "asc")}
      >
        {sortDir === "asc" ? (
          <ArrowUpIcon className="size-4" aria-hidden="true" />
        ) : (
          <ArrowDownIcon className="size-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
