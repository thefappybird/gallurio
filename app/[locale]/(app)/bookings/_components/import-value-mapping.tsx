"use client";

import { useTranslations } from "next-intl";
import { AlertTriangleIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UnmappedEnumValue } from "@/lib/bookings/import-mapping";
import { BOOKING_STATUSES, EVENT_TYPES } from "@/lib/validators/booking";

/** Distinct from "" so "leave it blank" is a real answer, not an absent one. */
const BLANK = "gw:blank";

const MEMBERS: Record<string, readonly string[]> = {
  status: BOOKING_STATUSES,
  eventType: EVENT_TYPES,
};

type Props = {
  unmapped: UnmappedEnumValue[];
  /** field key -> the file's value -> our value. "" means import it blank. */
  valueMap: Record<string, Record<string, string>>;
  onChange: (next: Record<string, Record<string, string>>) => void;
  /** field key -> the header the values came from, for the "From X" line. */
  sourceColumns: Record<string, string>;
};

/**
 * Maps a file's own vocabulary onto ours, once per distinct value.
 *
 * Without this a column of "Confirmed" fails every row it touches and the user
 * is told to go fix their spreadsheet. Answering once here is the difference
 * between importing fourteen bookings and reporting fourteen failures, which is
 * why the row count is given the same weight as the value itself.
 */
export function ImportValueMapping({ unmapped, valueMap, onChange, sourceColumns }: Props) {
  const t = useTranslations("app.bookings.import.values");

  const answered = (entry: UnmappedEnumValue) =>
    valueMap[entry.field]?.[entry.value] !== undefined;
  const outstanding = unmapped.filter((entry) => !answered(entry)).length;

  const setValue = (field: string, from: string, to: string) => {
    onChange({
      ...valueMap,
      [field]: { ...valueMap[field], [from]: to === BLANK ? "" : to },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="font-heading text-base font-medium text-foreground">{t("title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {unmapped.map((entry) => {
          const current = valueMap[entry.field]?.[entry.value];
          const selected = current === "" ? BLANK : (current ?? entry.suggestion ?? "");
          return (
            <li
              key={`${entry.field}:${entry.value}`}
              className="flex flex-col gap-2 bg-card p-3 ring-1 ring-foreground/10 @sm:flex-row @sm:items-center @sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{entry.value}</p>
                <p className="text-xs text-muted-foreground">
                  <span>
                    {t("fromColumn", { column: sourceColumns[entry.field] ?? entry.field })}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>{t("rowCount", { count: entry.count })}</span>
                </p>
              </div>
              <Select
                value={selected}
                onValueChange={(v) => setValue(entry.field, entry.value, v ?? BLANK)}
              >
                <SelectTrigger aria-label={entry.value} className="@sm:w-48">
                  <SelectValue placeholder={t("choose")} />
                </SelectTrigger>
                <SelectContent>
                  {(MEMBERS[entry.field] ?? []).map((member) => (
                    <SelectItem key={member} value={member}>
                      {member}
                    </SelectItem>
                  ))}
                  <SelectItem value={BLANK}>{t("leaveBlank")}</SelectItem>
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>

      {outstanding > 0 ? (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" />
          {t("unmatchedWarning", { count: outstanding })}
        </p>
      ) : null}
    </div>
  );
}
