"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRightIcon, PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAPPABLE_FIELDS,
  assignmentSources,
  type Assignment,
  type ColumnMapping,
  type FieldGroup,
  type MappableField,
} from "@/lib/bookings/import-mapping";
import { BOOKING_STATUSES } from "@/lib/validators/booking";
import { coerceDate, type DateOrder } from "@/lib/bookings/import-normalize";
import { cn } from "@/lib/utils";
import { formatImportInstant } from "./import-format";

/**
 * Sentinels for the picker. A source column is identified by its own header
 * text, so these carry a prefix no spreadsheet header realistically uses — a
 * file with a column literally called "Not imported" must still map cleanly.
 */
const NONE = "gw:none";
const CONSTANT = "gw:constant";
const INFER = "gw:infer";

type Props = {
  headers: string[];
  /** First data row, used for the sample line under each assigned field. */
  sampleRow: Record<string, string> | undefined;
  rowCount: number;
  mapping: ColumnMapping;
  onChange: (next: ColumnMapping) => void;
  dateOrder: DateOrder;
  onDateOrderChange: (next: DateOrder) => void;
  /** Workspace timezone, so a sample date reads as it will be saved. */
  timeZone: string;
  /**
   * A value from the file that reads both ways, or null when nothing is
   * ambiguous. Shown verbatim so the choice is about their data, not ours.
   */
  ambiguousDateExample: string | null;
  /** True while an XLSX is being parsed server-side and there is nothing yet. */
  loading?: boolean;
};

const GROUP_ORDER: FieldGroup[] = ["required", "common", "advanced"];

/** Source list -> the mapping shape: none, one `source`, or combined `sources`. */
function assignmentFromSources(next: string[]): Assignment {
  if (next.length === 0) return null;
  if (next.length === 1) return { source: next[0] };
  return { sources: next };
}

/** Column `value` picked in slot `index` of a field currently reading `sources`. */
export function assignSlot(sources: string[], index: number, value: string): Assignment {
  const next = [...sources];
  next[index] = value;
  return assignmentFromSources(next);
}

export function ImportColumnMapping({
  headers,
  sampleRow,
  rowCount,
  mapping,
  onChange,
  dateOrder,
  onDateOrderChange,
  timeZone,
  ambiguousDateExample,
  loading = false,
}: Props) {
  const t = useTranslations("app.bookings.import.mapping");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Every column already spoken for, so the picker can mark the rest as taken
  // rather than letting two fields silently read the same column.
  const usedColumns = useMemo(() => {
    const used = new Set<string>();
    for (const assignment of Object.values(mapping)) {
      for (const source of assignmentSources(assignment)) used.add(source);
    }
    return used;
  }, [mapping]);

  const missingRequired = MAPPABLE_FIELDS.filter(
    (f) => f.required && !mapping[f.key]
  ).length;

  const setAssignment = (key: string, assignment: Assignment) => {
    onChange({ ...mapping, [key]: assignment });
  };

  if (loading) return <MappingSkeleton label={t("loading")} />;

  const byGroup = (group: FieldGroup) => MAPPABLE_FIELDS.filter((f) => f.group === group);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="font-heading text-base font-medium text-foreground">{t("title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-foreground/10">
            {t("columnsFound", { count: headers.length })}
          </span>
          <span className="px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-foreground/10">
            {t("rowsFound", { count: rowCount })}
          </span>
        </div>
      </div>

      {GROUP_ORDER.map((group) => {
        const fields = byGroup(group);
        if (fields.length === 0) return null;

        if (group === "advanced") {
          return (
            <section key={group} className="border border-border">
              <button
                type="button"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((open) => !open)}
                className="flex w-full items-center gap-1.5 bg-muted px-3 py-2 text-start text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ChevronRightIcon
                  className={cn(
                    "size-3.5 shrink-0 motion-safe:transition-transform",
                    advancedOpen && "rotate-90"
                  )}
                />
                {t("sectionAdvanced")}
              </button>
              {advancedOpen ? (
                <div className="flex flex-col gap-3 p-3">
                  <p className="text-xs text-muted-foreground">{t("advancedHint")}</p>
                  <FieldGrid
                    fields={fields}
                    headers={headers}
                    sampleRow={sampleRow}
                    mapping={mapping}
                    usedColumns={usedColumns}
                    onAssign={setAssignment}
                    dateOrder={dateOrder}
                    onDateOrderChange={onDateOrderChange}
                    timeZone={timeZone}
                    ambiguousDateExample={ambiguousDateExample}
                  />
                </div>
              ) : null}
            </section>
          );
        }

        return (
          <section key={group} className="flex flex-col gap-2">
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group === "required" ? t("sectionRequired") : t("sectionCommon")}
            </h4>
            <FieldGrid
              fields={fields}
              headers={headers}
              sampleRow={sampleRow}
              mapping={mapping}
              usedColumns={usedColumns}
              onAssign={setAssignment}
              dateOrder={dateOrder}
              onDateOrderChange={onDateOrderChange}
              timeZone={timeZone}
              ambiguousDateExample={ambiguousDateExample}
            />
          </section>
        );
      })}

      {missingRequired > 0 ? (
        <p role="status" className="text-xs text-destructive">
          {t("continueBlocked", { count: missingRequired })}
        </p>
      ) : null}
    </div>
  );
}

type GridProps = {
  fields: readonly MappableField[];
  headers: string[];
  sampleRow: Record<string, string> | undefined;
  mapping: ColumnMapping;
  usedColumns: Set<string>;
  onAssign: (key: string, assignment: Assignment) => void;
  dateOrder: DateOrder;
  onDateOrderChange: (next: DateOrder) => void;
  timeZone: string;
  ambiguousDateExample: string | null;
};

function FieldGrid(props: GridProps) {
  return (
    <div className="grid gap-3 @md:grid-cols-2">
      {props.fields.map((field) => (
        <FieldCard key={field.key} field={field} {...props} />
      ))}
    </div>
  );
}

function FieldCard({
  field,
  headers,
  sampleRow,
  mapping,
  usedColumns,
  onAssign,
  dateOrder,
  onDateOrderChange,
  timeZone,
  ambiguousDateExample,
}: GridProps & { field: MappableField }) {
  const t = useTranslations("app.bookings.import.mapping");
  // Plain-language name and hint per field, so nobody has to know that the
  // template calls a booking's start "startAt".
  const tField = useTranslations("app.bookings.import.fields");
  const tStatus = useTranslations("app.bookings.statusValues");
  const locale = useLocale();
  const assignment = mapping[field.key];
  const unresolved = field.required && !assignment;
  const label = tField(`${field.key}.label`);

  const sources = assignmentSources(assignment);
  // The "+" click opens one empty slot; it only becomes part of the mapping
  // once a column is picked, so applyMapping never receives a blank source.
  const [pendingSlot, setPendingSlot] = useState(false);
  const slots = pendingSlot ? [...sources, ""] : sources;

  const selected =
    assignment == null
      ? NONE
      : sources.length > 0
        ? sources[0]
        : "infer" in assignment
          ? INFER
          : CONSTANT;

  const sample =
    sources.length > 0
      ? sources
          .map((s) => sampleRow?.[s]?.trim() ?? "")
          .filter(Boolean)
          .join(" ")
      : undefined;

  // The coerced date, in the workspace's clock: the quickest way to see that
  // 03/04 was read the way the file meant it.
  let readableDate: string | null = null;
  if (field.kind === "date" && sample) {
    const coerced = coerceDate(sample, timeZone, dateOrder);
    if (coerced.ok && coerced.value) {
      readableDate = formatImportInstant(coerced.value, locale, timeZone, sample);
    }
  }

  const commit = (next: string[]) => {
    setPendingSlot(false);
    onAssign(field.key, assignmentFromSources(next));
  };

  const onSelect = (value: string | null) => {
    setPendingSlot(false);
    if (value == null || value === NONE) return onAssign(field.key, null);
    if (value === INFER) return onAssign(field.key, { infer: true });
    if (value === CONSTANT) return onAssign(field.key, { constant: "" });
    commit([value, ...sources.slice(1)]);
  };

  const onSlotSelect = (index: number, value: string | null) => {
    if (value == null) return;
    setPendingSlot(false);
    onAssign(field.key, assignSlot(sources, index, value));
  };

  // The removed slot's controls unmount with it, so hand focus to the slot
  // above (slot 0 is the card's main picker) instead of dropping it on <body>.
  // The target stays mounted (only the removed row unmounts), so focus now.
  const removeSlot = (index: number) => {
    document
      .getElementById(index - 1 === 0 ? `map-${field.key}` : `map-${field.key}-slot-${index - 1}`)
      ?.focus();
    if (index >= sources.length) return setPendingSlot(false);
    commit(sources.filter((_, i) => i !== index));
  };

  const columnOptions = (current: string) =>
    headers.map((header) => {
      const takenElsewhere = usedColumns.has(header) && header !== current;
      return (
        <SelectItem key={header} value={header} disabled={takenElsewhere}>
          {takenElsewhere ? t("alreadyUsed", { column: header }) : header}
        </SelectItem>
      );
    });

  const statusItems = BOOKING_STATUSES.map((s) => ({ value: s, label: tStatus(s) }));

  return (
    <div
      className={cn(
        "flex flex-col gap-2 bg-card p-3 ring-1",
        unresolved ? "ring-destructive/40" : "ring-foreground/10"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <label htmlFor={`map-${field.key}`} className="text-sm leading-6 font-medium text-foreground">
          {label}
        </label>
        <div className="flex shrink-0 items-center gap-1">
          {field.required ? <Badge variant="default">{t("sectionRequired")}</Badge> : null}
          {field.combinable && sources.length > 0 && !pendingSlot ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("combineColumns")}
              title={t("combineColumns")}
              onClick={() => setPendingSlot(true)}
            >
              <PlusIcon />
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{tField(`${field.key}.hint`)}</p>

      <Select
        value={selected}
        onValueChange={onSelect}
        items={[
          { value: NONE, label: t("notImported") },
          { value: INFER, label: t("inferFromDate") },
          { value: CONSTANT, label: t("useFixedValue") },
          ...headers.map((h) => ({ value: h, label: h })),
        ]}
      >
        <SelectTrigger
          id={`map-${field.key}`}
          aria-label={slots.length > 1 ? t("columnSlot", { field: label, n: 1 }) : label}
        >
          <SelectValue placeholder={t("selectColumn")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("notImported")}</SelectItem>
          {field.key === "status" ? (
            <SelectItem value={INFER}>{t("inferFromDate")}</SelectItem>
          ) : null}
          {field.constantAllowed ? (
            <SelectItem value={CONSTANT}>{t("useFixedValue")}</SelectItem>
          ) : null}
          {columnOptions(sources[0] ?? "")}
        </SelectContent>
      </Select>

      {slots.slice(1).map((slot, i) => {
        const index = i + 1;
        return (
          <div key={index} className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <Select
                value={slot || null}
                onValueChange={(v) => onSlotSelect(index, v)}
                items={headers.map((h) => ({ value: h, label: h }))}
              >
                <SelectTrigger
                  id={`map-${field.key}-slot-${index}`}
                  aria-label={t("columnSlot", { field: label, n: index + 1 })}
                >
                  <SelectValue placeholder={t("selectColumn")} />
                </SelectTrigger>
                <SelectContent>{columnOptions(slot)}</SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("removeColumn")}
              title={t("removeColumn")}
              onClick={() => removeSlot(index)}
            >
              <XIcon />
            </Button>
          </div>
        );
      })}

      {assignment && "constant" in assignment ? (
        field.key === "status" ? (
          <Select
            value={assignment.constant}
            onValueChange={(v) => onAssign(field.key, { constant: v ?? "" })}
            items={statusItems}
          >
            <SelectTrigger aria-label={t("fixedValueLabel")}>
              <SelectValue placeholder={t("fixedValueLabel")} />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            aria-label={t("fixedValueLabel")}
            placeholder={t("fixedValueLabel")}
            value={assignment.constant}
            onChange={(e) => onAssign(field.key, { constant: e.target.value })}
          />
        )
      ) : null}

      {assignment && "infer" in assignment ? (
        <p className="text-xs text-muted-foreground">{t("inferHint")}</p>
      ) : null}

      {unresolved ? (
        <p className="text-xs text-destructive">{t("unassignedRequired")}</p>
      ) : sample !== undefined ? (
        <p className="truncate text-xs text-muted-foreground" title={sample}>
          {!sample
            ? t("sampleEmpty")
            : readableDate
              ? t("sampleDate", { value: sample, formatted: readableDate })
              : t("sample", { value: sample })}
        </p>
      ) : null}

      {/* One file-wide day/month order, offered on whichever mapped date card
          sees an ambiguous value (startAt before endAt) — not a per-column
          setting. A plain text action: most files are read right the first
          time, so this stays quiet until the sample above looks wrong. */}
      {field.kind === "date" && sources.length > 0 && ambiguousDateExample ? (
        <>
          <p id={`map-${field.key}-order-hint`} className="text-xs text-muted-foreground">
            {t("swapDayMonthHint", { example: ambiguousDateExample })}
          </p>
          <button
            type="button"
            aria-pressed={dateOrder === "DMY"}
            aria-describedby={`map-${field.key}-order-hint`}
            onClick={() => onDateOrderChange(dateOrder === "MDY" ? "DMY" : "MDY")}
            className="self-start rounded-(--radius) text-xs font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("swapDayMonth")}
          </button>
        </>
      ) : null}
    </div>
  );
}

function MappingSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div>
        <Skeleton className="h-5 w-56" />
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
      {[0, 1].map((section) => (
        <div key={section} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <div className="grid gap-3 @md:grid-cols-2">
            {[0, 1, 2, 3].map((card) => (
              <div key={card} className="flex flex-col gap-2 bg-card p-3 ring-1 ring-foreground/10">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
