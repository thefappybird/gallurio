"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClientStep } from "./booking-wizard-steps/client-step";
import { EventStep, type ShiftHit } from "./booking-wizard-steps/event-step";
import { PricingStep } from "./booking-wizard-steps/pricing-step";
import { ReviewStep } from "./booking-wizard-steps/review-step";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import type {
  WizardMode,
  WizardValues,
} from "./booking-wizard-steps/types";
import type { SupportedCurrency } from "@/lib/validators/workspace";
import { cn } from "@/lib/utils";

type Props = {
  mode: WizardMode;
  /** Booking id in edit mode. */
  bookingId?: string;
  /** ISO date YYYY-MM-DD to pre-populate startAt in create mode. */
  defaultDate?: string;
  /** HH:MM to pre-populate startTime in create mode (from week/day slot click). */
  defaultTime?: string;
  defaultCurrency: SupportedCurrency;
  /** Pre-fetched booking values for edit mode. */
  initialValues?: Partial<WizardValues>;
  locale: string;
};

type StepDef = {
  id: "client" | "event" | "pricing" | "review";
  fields: (keyof WizardValues | "amount.total" | "amount.deposit")[];
};

const STEPS: StepDef[] = [
  { id: "client", fields: ["client"] },
  { id: "event", fields: ["title", "eventType", "sessions", "location"] },
  { id: "pricing", fields: ["amount"] },
  { id: "review", fields: [] },
];

export function BookingWizardModal({
  mode,
  bookingId,
  defaultDate,
  defaultTime,
  defaultCurrency,
  initialValues,
  locale,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.wizard");
  const [, startTransition] = useTransition();

  const [open, setOpen] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit" && !initialValues);
  const [editClientName, setEditClientName] = useState<string | undefined>(
    initialValues?.client?.mode === "existing"
      ? initialValues.client.clientName
      : undefined
  );
  /** Steps that have failed validation since the user last interacted with
   *  them. Drives the red-asterisk + shake markers in the header. */
  const [stepErrors, setStepErrors] = useState<Set<number>>(new Set());
  /** Pulsed for one frame whenever the user clicks a disallowed step or hits
   *  Next without passing validation. Drives the shake animation. */
  const [shakeKey, setShakeKey] = useState(0);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  /** Raw shifts per session index — keyed by startDate string.
   *  Re-fetched whenever any session's startDate changes. */
  const [rawShiftsByDate, setRawShiftsByDate] = useState<Record<string, ShiftHit[]>>({});

  const defaults = useMemo(
    () => makeDefaults({ defaultDate, defaultTime, defaultCurrency, initialValues }),
    [defaultDate, defaultTime, defaultCurrency, initialValues]
  );

  const form = useForm<WizardValues>({
    defaultValues: defaults,
    mode: "onChange",
  });

  // Edit mode: fetch the booking and reset the form with its values.
  useEffect(() => {
    if (mode !== "edit" || !bookingId || initialValues) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (cancelled || !b) return;
        const rawSessions: { startAt: string; endAt: string }[] =
          Array.isArray(b.sessions) && b.sessions.length > 0
            ? b.sessions
            : [];
        const today = new Date().toISOString().slice(0, 10);
        const wizardSessions = rawSessions.map((s) => {
          const sd = new Date(s.startAt);
          const ed = new Date(s.endAt);
          const startDate = sd.toISOString().slice(0, 10);
          const endDate = ed.toISOString().slice(0, 10);
          const startTime = `${String(sd.getHours()).padStart(2, "0")}:${String(sd.getMinutes()).padStart(2, "0")}`;
          const endTime = `${String(ed.getHours()).padStart(2, "0")}:${String(ed.getMinutes()).padStart(2, "0")}`;
          return {
            startDate,
            startTime,
            endDate: startDate === endDate ? "" : endDate,
            endTime,
            singleDay: startDate === endDate,
            allowPastDate: startDate < today,
          };
        });
        const next: WizardValues = {
          client: {
            mode: "existing",
            clientId: String(b.clientId ?? ""),
            clientName: b.clientName ?? "",
          },
          title: b.title ?? "",
          eventType: b.eventType ?? "other",
          status: b.status ?? "inquiry",
          sessions:
            wizardSessions.length > 0
              ? wizardSessions
              : [
                  {
                    startDate: "",
                    startTime: "10:00",
                    endDate: "",
                    endTime: "17:00",
                    singleDay: true,
                    allowPastDate: false,
                  },
                ],
          location: { address: b.location?.address ?? "" },
          amount: {
            total: b.amount?.total ?? 0,
            deposit: b.amount?.deposit ?? 0,
            currency: b.amount?.currency ?? defaultCurrency,
          },
          notes: b.notes ?? "",
        };
        form.reset(next);
        setEditClientName(b.clientName ?? undefined);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, bookingId, initialValues, defaultCurrency, form]);

  const {
    control,
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = form;

  // Watch all session startDates to know which dates need conflict lookups.
  const watchedSessions = watch("sessions");
  const sessionDates = useMemo(
    () => (watchedSessions ?? []).map((s) => s.startDate),
    [watchedSessions]
  );

  // Fetch shifts for each unique startDate. Cached by date so navigating
  // back to a date doesn't re-fetch. Clears stale dates automatically.
  useEffect(() => {
    const uniqueDates = [...new Set(sessionDates.filter(Boolean))];
    if (uniqueDates.length === 0) return;

    let cancelled = false;
    Promise.all(
      uniqueDates.map(async (date) => {
        const params = new URLSearchParams({ date });
        if (mode === "edit" && bookingId) params.set("excludeId", bookingId);
        try {
          const r = await fetch(
            `/api/bookings/shifts-on-date?${params.toString()}`
          );
          const data: { shifts: ShiftHit[] } = r.ok
            ? await r.json()
            : { shifts: [] };
          return [date, data.shifts ?? []] as const;
        } catch {
          return [date, [] as ShiftHit[]] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setRawShiftsByDate(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sessionDates), mode, bookingId]);

  // For each session, filter the fetched shifts to only those overlapping the
  // session's time window. This is the array EventStep renders as warnings,
  // and any non-empty entry blocks the Next button.
  const conflictsBySession: ShiftHit[][] = useMemo(
    () =>
      (watchedSessions ?? []).map((s) => {
        const raw = rawShiftsByDate[s.startDate] ?? [];
        if (raw.length === 0) return raw;
        const aStart = toMinutes(s.startTime);
        const aEnd = toMinutes(s.endTime);
        if (aStart == null || aEnd == null || aEnd <= aStart) return raw;
        return raw.filter((c) => {
          const bStart = toMinutes(c.shiftStart);
          const bEnd = toMinutes(c.shiftEnd);
          if (bStart == null || bEnd == null) return false;
          return aStart < bEnd && bStart < aEnd;
        });
      }),
    [watchedSessions, rawShiftsByDate]
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("add");
    params.delete("date");
    params.delete("edit");
    const qs = params.toString();
    setOpen(false);
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }, [router, pathname, searchParams]);

  /** Validates a single step's fields. Returns true if the step is good. */
  async function validateStep(index: number): Promise<boolean> {
    const step = STEPS[index];
    const fieldPaths = step.fields as (keyof WizardValues)[];
    const rhfOk =
      fieldPaths.length === 0 ? true : await trigger(fieldPaths);
    if (step.id === "client") {
      const client = watch("client");
      if (
        (client.mode === "existing" && !client.clientId) ||
        (client.mode === "new" && !client.name.trim())
      ) {
        return false;
      }
    }
    if (step.id === "event") {
      const title = watch("title");
      const sessions = watch("sessions") ?? [];
      if (!title?.trim()) return false;
      // Every session must have a start date.
      if (sessions.length === 0 || sessions.some((s) => !s.startDate)) return false;
      // Hard-block on scheduling conflicts — proceeding with overlapping bookings is not allowed.
      if (conflictsBySession.some((c) => c.length > 0)) return false;
    }
    if (step.id === "pricing") {
      const { total, deposit } = watch("amount");
      if (typeof total !== "number" || total < 0) return false;
      if (typeof deposit !== "number" || deposit < 0) return false;
      if (deposit > total) return false;
    }
    return rhfOk;
  }

  function markStepInvalid(index: number) {
    setStepErrors((s) => new Set(s).add(index));
    setShakeKey((k) => k + 1);
  }
  function clearStepInvalid(index: number) {
    setStepErrors((s) => {
      if (!s.has(index)) return s;
      const next = new Set(s);
      next.delete(index);
      return next;
    });
  }

  async function nextStep() {
    const ok = await validateStep(stepIndex);
    if (!ok) {
      markStepInvalid(stepIndex);
      // Pricing's specific "deposit > total" surfaces as a top-of-footer error.
      if (STEPS[stepIndex].id === "pricing") {
        const { total, deposit } = watch("amount");
        if (deposit > total) setSubmitError(t("depositExceedsTotal"));
      }
      return;
    }
    clearStepInvalid(stepIndex);
    setSubmitError(null);
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }

  function previousStep() {
    setSubmitError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  /** Step header click: validate everything between current and target. */
  async function jumpToStep(target: number) {
    if (target === stepIndex) return;
    if (target < stepIndex) {
      // Going back is always allowed; clear local error for the step we leave.
      clearStepInvalid(stepIndex);
      setStepIndex(target);
      return;
    }
    // Going forward: validate every step in between (including current).
    for (let i = stepIndex; i < target; i += 1) {
      const ok = await validateStep(i);
      if (!ok) {
        markStepInvalid(i);
        setStepIndex(i);
        return;
      }
      clearStepInvalid(i);
    }
    setStepIndex(target);
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (mode === "create") {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildCreatePayload(values)),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Couldn't create booking");
        }
        toast.success(t("createdToast"));
      } else {
        if (!bookingId) throw new Error("Missing booking id");
        const diff = buildEditDiff(values, defaults);
        if (Object.keys(diff).length === 0) {
          // No-op submit — just close.
          close();
          return;
        }
        const res = await fetch(`/api/bookings/${bookingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(diff),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Couldn't save booking");
        }
        toast.success(t("savedToast"));
      }
      startTransition(() => router.refresh());
      close();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSubmitting(false);
    }
  });

  function attemptClose(next: boolean) {
    if (next) return;
    // Warn if the user has unsaved progress — via an in-app dialog so we keep
    // them inside the design system instead of bouncing them to a browser alert.
    if (isDirty && !submitting) {
      setUnsavedDialogOpen(true);
      return;
    }
    close();
  }

  /** Save in edit mode without having to navigate to the final step. */
  const saveFromAnywhere = async () => {
    if (mode !== "edit") return;
    // Validate every step's required fields before saving.
    for (let i = 0; i < STEPS.length; i += 1) {
      const ok = await validateStep(i);
      if (!ok) {
        markStepInvalid(i);
        setStepIndex(i);
        return;
      }
      clearStepInvalid(i);
    }
    await onSubmit();
  };

  const current = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const isReadOnlyClient = mode === "edit";
  const values = watch();

  return (
    <Dialog open={open} onOpenChange={attemptClose}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-col gap-1">
            <DialogTitle>
              {mode === "create" ? t("createTitle") : t("editTitle")}
            </DialogTitle>
            <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {STEPS.map((s, i) => {
                const hasError = stepErrors.has(i);
                const isCurrent = i === stepIndex;
                return (
                  <li key={s.id} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => jumpToStep(i)}
                      className={cn(
                        "group/step flex cursor-pointer items-center gap-1.5 outline-none transition-colors",
                        i <= stepIndex ? "text-foreground" : "text-muted-foreground",
                        "hover:text-foreground focus-visible:text-foreground",
                        // Shake the current step indicator when validation fails.
                        isCurrent && hasError && "animate-shake"
                      )}
                      key={`${s.id}-${isCurrent && hasError ? shakeKey : 0}`}
                    >
                      <span
                        className={cn(
                          "inline-flex size-5 items-center justify-center border text-[10px] font-semibold",
                          isCurrent
                            ? "border-brand bg-brand text-brand-foreground"
                            : i < stepIndex
                              ? "border-foreground"
                              : "border-border",
                          hasError && "border-destructive"
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="hidden sm:inline">{t(`steps.${s.id}`)}</span>
                      {hasError ? (
                        <span
                          className="text-destructive"
                          aria-label="Has validation errors"
                        >
                          *
                        </span>
                      ) : null}
                    </button>
                    {i < STEPS.length - 1 ? (
                      <span className="text-border">›</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => attemptClose(false)}
              >
                <XIcon className="size-4" />
              </Button>
            }
          />
        </div>

        <form
          onSubmit={onSubmit}
          className="flex min-h-96 flex-1 flex-col overflow-y-auto"
        >
          <div className="flex flex-1 flex-col gap-3 px-4 py-3">
            {loading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("loading")}
              </p>
            ) : null}
            {!loading && current.id === "client" ? (
              <ClientStep
                control={control}
                errors={errors}
                readOnly={isReadOnlyClient}
                readOnlyClientName={editClientName}
              />
            ) : null}
            {!loading && current.id === "event" ? (
              <EventStep
                control={control}
                register={register}
                watch={watch}
                setValue={setValue}
                errors={errors}
                conflictsBySession={conflictsBySession}
              />
            ) : null}
            {!loading && current.id === "pricing" ? (
              <PricingStep
                control={control}
                register={register}
                errors={errors}
              />
            ) : null}
            {!loading && current.id === "review" ? (
              <ReviewStep values={values} locale={locale} />
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3">
            {submitError ? (
              <p className="text-xs text-destructive">{submitError}</p>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => attemptClose(false)}
                  disabled={submitting}
                >
                  {t("cancel")}
                </Button>
                {mode === "edit" ? (
                  <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    onClick={saveFromAnywhere}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : null}
                    {submitting ? t("saving") : t("save")}
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={previousStep}
                  disabled={stepIndex === 0 || submitting}
                >
                  <ChevronLeftIcon className="size-4" />
                  {t("previous")}
                </Button>
                {!isLast ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={nextStep}
                    disabled={submitting || (STEPS[stepIndex].id === "event" && conflictsBySession.some((c) => c.length > 0))}
                    key={`next-${stepErrors.has(stepIndex) ? shakeKey : 0}`}
                    variant="brand"
                    className={cn(stepErrors.has(stepIndex) && "animate-shake")}
                  >
                    {t("next")}
                    <ChevronRightIcon className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="brand"
                    size="sm"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : null}
                    {mode === "create"
                      ? submitting
                        ? t("creating")
                        : t("create")
                      : submitting
                        ? t("saving")
                        : t("save")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </DialogContent>

      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        onKeepEditing={() => setUnsavedDialogOpen(false)}
        onDiscard={() => {
          setUnsavedDialogOpen(false);
          close();
        }}
      />

    </Dialog>
  );
}

function makeDefaults({
  defaultDate,
  defaultTime,
  defaultCurrency,
  initialValues,
}: {
  defaultDate?: string;
  defaultTime?: string;
  defaultCurrency: SupportedCurrency;
  initialValues?: Partial<WizardValues>;
}): WizardValues {
  const today = new Date().toISOString().slice(0, 10);
  const defaultSession = {
    startDate: defaultDate ?? "",
    startTime: defaultTime ?? "10:00",
    endDate: "",
    endTime: "17:00",
    singleDay: true,
    allowPastDate: defaultDate ? defaultDate < today : false,
  };

  return {
    client:
      initialValues?.client ??
      ({ mode: "existing", clientId: "", clientName: "" } as const),
    title: initialValues?.title ?? "",
    eventType: initialValues?.eventType ?? "other",
    status: initialValues?.status ?? "inquiry",
    sessions:
      initialValues?.sessions && initialValues.sessions.length > 0
        ? initialValues.sessions
        : [defaultSession],
    location: initialValues?.location ?? { address: "" },
    amount: {
      total: initialValues?.amount?.total ?? 0,
      deposit: initialValues?.amount?.deposit ?? 0,
      currency: initialValues?.amount?.currency ?? defaultCurrency,
    },
    notes: initialValues?.notes ?? "",
  };
}

function combineDateTime(date: string, time: string): string {
  if (!date) return "";
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return new Date(`${date}T${t}:00`).toISOString();
}

function sessionsToPayload(
  sessions: WizardValues["sessions"]
): { startAt: string; endAt: string }[] {
  return sessions.map((s) => {
    const startIso = combineDateTime(s.startDate, s.startTime);
    // Single-day: end date = start date. Multi-day: use endDate.
    const endDate = s.singleDay ? s.startDate : s.endDate || s.startDate;
    const endIso = combineDateTime(endDate, s.endTime || s.startTime);
    return { startAt: startIso, endAt: endIso };
  });
}

function buildCreatePayload(v: WizardValues) {
  // POST /api/bookings expects bookingCreateSchema — strip clientName from
  // existing-mode client (server looks it up by id) and pass everything else
  // through. Date + time combine into full ISO strings here.
  const client =
    v.client.mode === "existing"
      ? { mode: "existing" as const, clientId: v.client.clientId }
      : {
          mode: "new" as const,
          name: v.client.name,
          email: v.client.email || null,
          phone: v.client.phone || null,
        };

  return {
    client,
    title: v.title,
    eventType: v.eventType,
    status: v.status,
    sessions: sessionsToPayload(v.sessions),
    location: { address: v.location.address },
    amount: {
      total: v.amount.total,
      deposit: v.amount.deposit,
      currency: v.amount.currency,
    },
    notes: v.notes,
  };
}

function buildEditDiff(
  v: WizardValues,
  defaults: WizardValues
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  if (v.title !== defaults.title) diff.title = v.title;
  if (v.eventType !== defaults.eventType) diff.eventType = v.eventType;
  if (v.status !== defaults.status) diff.status = v.status;

  // Always send sessions if anything changed — the server recomputes
  // firstSessionStart/lastSessionEnd from the full array.
  const sessionsChanged =
    JSON.stringify(v.sessions) !== JSON.stringify(defaults.sessions);
  if (sessionsChanged) {
    diff.sessions = sessionsToPayload(v.sessions);
  }

  if (v.location.address !== defaults.location.address)
    diff["location.address"] = v.location.address;
  if (v.amount.total !== defaults.amount.total)
    diff["amount.total"] = v.amount.total;
  if (v.amount.deposit !== defaults.amount.deposit)
    diff["amount.deposit"] = v.amount.deposit;
  if (v.amount.currency !== defaults.amount.currency)
    diff["amount.currency"] = v.amount.currency;
  if (v.notes !== defaults.notes) diff.notes = v.notes;
  return diff;
}

/** Parse "HH:MM" → minutes since midnight, or null for malformed input. */
function toMinutes(hhmm: string | undefined | null): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

// Re-export for the page wrapper.
export type { WizardValues };
