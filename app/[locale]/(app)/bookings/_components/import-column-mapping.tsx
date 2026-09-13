"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  type Assignment,
  type ColumnMapping,
  type FieldGroup,
  type MappableField,
} from "@/lib/bookings/import-mapping";
import { BOOKING_STATUSES } from "@/lib/validators/booking";
import type { DateOrder } from "@/lib/bookings/import-normalize";
import { cn } from "@/lib/utils";

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
  /**
   * A value from the file that reads both ways, or null when nothing is
   * ambiguous. Shown verbatim so the choice is about their data, not ours.
   */
  ambiguousDateExample: string | null;
  /** True while an XLSX is being parsed server-side and there is nothing yet. */
  loading?: boolean;
};

const GROUP_ORDER: FieldGroup[] = ["required", "common", "advanced"];

export function ImportColumnMapping({
  headers,
  sampleRow,
  rowCount,
  mapping,
  onChange,
  dateOrder,
  onDateOrderChange,
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
      if (assignment && "source" in assignment) used.add(assignment.source);
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
  ambiguousDateExample,
}: GridProps & { field: MappableField }) {
  const t = useTranslations("app.bookings.import.mapping");
  // What the field means, keyed by the template's column name. These notes used
  // to live in a collapsed reference table that nobody opened while actually
  // choosing a column; on the card they answer the question being asked.
  const tSpec = useTranslations("app.bookings.import.dialog.spec");
  const assignment = mapping[field.key];
  const unresolved = field.required && !assignment;

  const selected =
    assignment == null
      ? NONE
      : "source" in assignment
        ? assignment.source
        : "infer" in assignment
          ? INFER
          : CONSTANT;

  const sample = assignment && "source" in assignment ? sampleRow?.[assignment.source] : undefined;

  const onSelect = (value: string | null) => {
    if (value == null || value === NONE) return onAssign(field.key, null);
    if (value === INFER) return onAssign(field.key, { infer: true });
    if (value === CONSTANT) return onAssign(field.key, { constant: "" });
    onAssign(field.key, { source: value });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 bg-card p-3 ring-1",
        unresolved ? "ring-destructive/40" : "ring-foreground/10"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <label
          htmlFor={`map-${field.key}`}
          className="font-mono text-xs leading-5 font-medium text-foreground"
        >
          {field.label}
        </label>
        <div className="flex shrink-0 items-center gap-1">
          {field.required ? (
            <Badge variant="default">
              {t("sectionRequired")}
            </Badge>
          ) : null}
          <Badge variant="secondary">
            {t(KIND_LABEL[field.kind])}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{tSpec(`${field.label}.note`)}</p>

      <Select value={selected} onValueChange={onSelect}>
        <SelectTrigger id={`map-${field.key}`} aria-label={field.label}>
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
          {headers.map((header) => {
            const takenElsewhere =
              usedColumns.has(header) &&
              !(assignment && "source" in assignment && assignment.source === header);
            return (
              <SelectItem key={header} value={header} disabled={takenElsewhere}>
                {takenElsewhere ? t("alreadyUsed", { column: header }) : header}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {assignment && "constant" in assignment ? (
        field.key === "status" ? (
          <Select
            value={assignment.constant}
            onValueChange={(v) => onAssign(field.key, { constant: v ?? "" })}
          >
            <SelectTrigger aria-label={t("fixedValueLabel")}>
              <SelectValue placeholder={t("fixedValueLabel")} />
            </SelectTrigger>
            <SelectContent>
              {BOOKING_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
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

      {/* The order toggle lives on the date card itself: it is a question about
          that column, and asking it anywhere else loses the connection. */}
      {field.kind === "date" && assignment && "source" in assignment && ambiguousDateExample ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          <span className="text-xs font-medium text-foreground">{t("dateOrderLabel")}</span>
          <div role="radiogroup" aria-label={t("dateOrderLabel")} className="flex gap-1">
            {(["MDY", "DMY"] as const).map((order) => (
              <button
                key={order}
                type="button"
                role="radio"
                aria-checked={dateOrder === order}
                onClick={() => onDateOrderChange(order)}
                className={cn(
                  "rounded-(--radius) px-2 py-1 text-xs motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  dateOrder === order
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground ring-1 ring-foreground/10 hover:text-foreground"
                )}
              >
                {t(order === "MDY" ? "dateOrderMDY" : "dateOrderDMY")}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("dateOrderHint", { example: ambiguousDateExample })}
          </p>
        </div>
      ) : null}

      {unresolved ? (
        <p className="text-xs text-destructive">{t("unassignedRequired")}</p>
      ) : sample !== undefined ? (
        <p className="truncate text-xs text-muted-foreground" title={sample}>
          {sample ? t("sample", { value: sample }) : t("sampleEmpty")}
        </p>
      ) : null}
    </div>
  );
}

const KIND_LABEL = {
  text: "kindText",
  date: "kindDate",
  money: "kindMoney",
  number: "kindNumber",
  enum: "kindEnum",
  json: "kindJson",
} as const;

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
