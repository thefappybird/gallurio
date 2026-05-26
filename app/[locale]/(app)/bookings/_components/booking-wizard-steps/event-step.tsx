"use client";

import { useEffect, useRef } from "react";
import {
  useFieldArray,
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import { AlertTriangleIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isToday, applyTodaySnap } from "../_helpers/today-snap";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EVENT_TYPES, type EventType } from "@/lib/validators/booking";
import type { WizardValues } from "./types";

export type ShiftHit = {
  id: string;
  bookingId?: string;
  sessionIndex?: number;
  title: string;
  shiftStart: string;
  shiftEnd: string;
};

type Props = {
  control: Control<WizardValues>;
  register: UseFormRegister<WizardValues>;
  watch: UseFormWatch<WizardValues>;
  setValue: UseFormSetValue<WizardValues>;
  errors: FieldErrors<WizardValues>;
  /** Per-session conflicts — array parallel to sessions[]. Passed in from the
   *  wizard host so the same data gates the Next button. */
  conflictsBySession: ShiftHit[][];
  /** Dates currently being fetched — used to show inline loading state per card. */
  loadingDates: Set<string>;
  /** When true, the conflict-check fetch failed — show an inline warning. */
  conflictCheckError?: boolean;
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowHHMM() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

const Asterisk = () => <span className="ml-0.5 text-destructive">*</span>;

function SessionCard({
  index,
  total,
  register,
  watch,
  setValue,
  errors,
  conflicts,
  loading,
  onRemove,
}: {
  index: number;
  total: number;
  register: UseFormRegister<WizardValues>;
  watch: UseFormWatch<WizardValues>;
  setValue: UseFormSetValue<WizardValues>;
  errors: FieldErrors<WizardValues>;
  conflicts: ShiftHit[];
  loading: boolean;
  onRemove: () => void;
}) {
  const t = useTranslations("app.bookings.wizard.event");
  const tSessions = useTranslations("app.bookings.sessions");

  const startDate = watch(`sessions.${index}.startDate`);
  const allowPastDate = watch(`sessions.${index}.allowPastDate`);

  const isPastDate = !!startDate && startDate < todayIso();
  const startMin = allowPastDate ? undefined : todayIso();
  // When the start date is today and past dates aren't allowed, block past
  // times of day in the start-time input. Matches the drag-and-drop
  // past-time confirm flow so both entry points enforce the same rule.
  const startTimeMin =
    !allowPastDate && startDate === todayIso() ? nowHHMM() : undefined;

  // Track the previous startDate so we can detect transitions to today.
  const prevStartRef = useRef(startDate);

  // When user picks a past date, auto-enable allowPastDate.
  useEffect(() => {
    if (isPastDate && !allowPastDate) {
      setValue(`sessions.${index}.allowPastDate`, true, { shouldDirty: false });
    }
  }, [isPastDate, allowPastDate, setValue, index]);

  // When start date transitions to today, snap start+end times to the next
  // 30-min slot after now. If the snap would push end past midnight, clamp
  // endTime to "23:59" instead of advancing the date (sessions are single-day).
  useEffect(() => {
    const prevStart = prevStartRef.current;
    prevStartRef.current = startDate;

    if (!startDate) return;

    const startBecameToday = prevStart !== startDate && isToday(startDate);
    if (!startBecameToday) return;

    const currentStartTime = watch(`sessions.${index}.startTime`);
    const currentEndTime = watch(`sessions.${index}.endTime`);
    const snapped = applyTodaySnap({
      prevStartDate: prevStart || startDate,
      prevStartTime: currentStartTime,
      prevEndDate: startDate,
      prevEndTime: currentEndTime,
    });

    if (snapped.startDate !== startDate) {
      // Snap crossed midnight — advance start date to tomorrow.
      setValue(`sessions.${index}.startDate`, snapped.startDate, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    setValue(`sessions.${index}.startTime`, snapped.startTime, {
      shouldDirty: true,
      shouldValidate: true,
    });

    // Clamp end time: sessions are strictly single-day, never cross midnight.
    const clampedEndTime =
      snapped.endDate !== (snapped.startDate) ? "23:59" : snapped.endTime;
    setValue(`sessions.${index}.endTime`, clampedEndTime, {
      shouldDirty: true,
      shouldValidate: true,
    });
  // prevStartRef is a stable ref and must NOT be in the dep array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, setValue, index]);

  const sessionErrors = errors.sessions?.[index];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border p-3",
        conflicts.length > 0 ? "border-destructive bg-destructive/5" : "border-border"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {tSessions("label", { n: index + 1 })}
        </span>
        {total > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={tSessions("remove")}
          >
            <Trash2Icon className="size-4" />
          </Button>
        ) : null}
      </div>

      {/* Row 1: Start date alone */}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`wiz-startDate-${index}`}>
          {t("startAt")}
          <Asterisk />
        </Label>
        <Input
          id={`wiz-startDate-${index}`}
          type="date"
          min={startMin}
          {...register(`sessions.${index}.startDate`, { required: true })}
          aria-invalid={sessionErrors?.startDate ? "true" : undefined}
        />
        {sessionErrors?.startDate ? (
          <p className="text-xs text-destructive">{t("startAtRequired")}</p>
        ) : null}
      </div>

      {/* Row 2: Start time + End time, 50/50 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`wiz-startTime-${index}`}>{t("startTime")}</Label>
          <Input
            id={`wiz-startTime-${index}`}
            type="time"
            min={startTimeMin}
            {...register(`sessions.${index}.startTime`, {
              required: true,
              pattern: /^\d{2}:\d{2}$/,
            })}
            aria-invalid={sessionErrors?.startTime ? "true" : undefined}
          />
          {sessionErrors?.startTime ? (
            <p className="text-xs text-destructive">{t("startTimeRequired")}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`wiz-endTime-${index}`}>{t("endTime")}</Label>
          <Input
            id={`wiz-endTime-${index}`}
            type="time"
            {...register(`sessions.${index}.endTime`, {
              required: true,
              pattern: /^\d{2}:\d{2}$/,
              validate: (v: string) => {
                const start = watch(`sessions.${index}.startTime`);
                if (!start || !v) return true;
                return v > start || "endTimeBeforeStart";
              },
            })}
            aria-invalid={sessionErrors?.endTime ? "true" : undefined}
          />
          {sessionErrors?.endTime ? (
            <p className="text-xs text-destructive">
              {sessionErrors.endTime.message === "endTimeBeforeStart"
                ? t("endTimeBeforeStart")
                : t("endTimeRequired")}
            </p>
          ) : null}
        </div>
      </div>

      {/* Conflict check loading indicator */}
      {loading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <Loader2Icon className="size-3.5 animate-spin" />
          <span>{t("checkingConflicts")}</span>
        </div>
      ) : null}

      {/* Conflicts for this session — only shown when not loading */}
      {!loading && conflicts.length > 0 ? (
        <div className="flex items-start gap-2 border border-destructive bg-destructive/10 px-3 py-2 text-xs">
          <AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold text-destructive">
              {t("conflictsLabel", { date: formatConflictDate(startDate) })}
            </span>
            <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-destructive">
              {conflicts.map((c) => (
                <li key={c.id}>
                  <span className="tabular-nums">
                    {c.shiftStart}–{c.shiftEnd}
                  </span>{" "}
                  <span className="opacity-80">{c.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Hint */}
      <p className="text-xs text-muted-foreground">{t("shiftHint")}</p>

      {/* Allow-past-date toggle */}
      <label
        className={`flex items-center gap-2 text-xs text-muted-foreground ${isPastDate ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          {...register(`sessions.${index}.allowPastDate`)}
          disabled={isPastDate}
          className="size-3.5 accent-brand disabled:cursor-not-allowed"
        />
        {t("allowPastDate")}
      </label>
    </div>
  );
}

export function EventStep({
  control,
  register,
  watch,
  setValue,
  errors,
  conflictsBySession,
  loadingDates,
  conflictCheckError = false,
}: Props) {
  const t = useTranslations("app.bookings.wizard.event");
  const tEvent = useTranslations("app.bookings.eventTypes");
  const tSessions = useTranslations("app.bookings.sessions");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sessions",
  });

  function addSession() {
    const last = fields[fields.length - 1];
    append({
      startDate: "",
      startTime: last?.startTime || "10:00",
      endTime: last?.endTime || "17:00",
      allowPastDate: false,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Title + Event type on one row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="wiz-title">
            {t("title")}
            <Asterisk />
          </Label>
          <Input
            id="wiz-title"
            {...register("title", { required: true })}
            placeholder={t("titlePlaceholder")}
            aria-invalid={errors.title ? "true" : undefined}
          />
          {errors.title ? (
            <p className="text-xs text-destructive">
              {errors.title.message ?? t("titleRequired")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="wiz-eventType">{t("eventType")}</Label>
          <Controller
            control={control}
            name="eventType"
            render={({ field }) => (
              <Select<EventType>
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
              >
                <SelectTrigger className="capitalize">
                  <SelectValue placeholder={t("eventType")} />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((e) => (
                    <SelectItem key={e} value={e} className="capitalize">
                      {safe(tEvent, e, e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* Conflict-check error warning */}
      {conflictCheckError ? (
        <p className="text-xs text-destructive">
          {"Couldn't verify conflicts — try again before continuing."}
        </p>
      ) : null}

      {/* Sessions list — only this region scrolls */}
      <div className="flex max-h-112 flex-col gap-3 overflow-y-auto pr-1">
        {fields.map((field, i) => {
          const sessionDate = watch(`sessions.${i}.startDate`);
          return (
            <SessionCard
              key={field.id}
              index={i}
              total={fields.length}
              register={register}
              watch={watch}
              setValue={setValue}
              errors={errors}
              conflicts={conflictsBySession[i] ?? []}
              loading={!!(sessionDate && loadingDates.has(sessionDate))}
              onRemove={() => remove(i)}
            />
          );
        })}
      </div>

      {/* Add session button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addSession}
        className="self-start"
      >
        <PlusIcon className="size-4" />
        {tSessions("add")}
      </Button>

      {/* Location — applies to all sessions */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="wiz-location">{t("location")}</Label>
        <Input
          id="wiz-location"
          {...register("location.address")}
          placeholder={t("locationPlaceholder")}
        />
      </div>
    </div>
  );
}

function safe(t: (k: string) => string, key: string, fallback: string) {
  try {
    const v = t(key);
    return v && v !== key ? v : fallback;
  } catch {
    return fallback;
  }
}

/** "2026-05-23" → "May 23, 2026". Falls back to the raw string. */
function formatConflictDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
