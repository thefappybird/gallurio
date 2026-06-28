"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
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
import { EventPricingStep } from "./booking-wizard-steps/event-pricing-step";
import { SessionsLocationStep } from "./booking-wizard-steps/sessions-location-step";
import { ReviewStep } from "./booking-wizard-steps/review-step";
import type { ShiftHit } from "./booking-wizard-steps/types";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import type {
  WizardMode,
  WizardValues,
} from "./booking-wizard-steps/types";
import type { SupportedCurrency } from "@/lib/validators/workspace";
import { cn } from "@/lib/utils";
import { StatusPill } from "./status-pill";
import {
  todayIso,
  applyTodaySnap,
} from "./_helpers/today-snap";
import { wallTimeInTzToUtc, FALLBACK_TZ } from "@/lib/utils/timezone";

type ClientHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

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
  /** IANA timezone for the workspace — used to convert wall-clock inputs to UTC. */
  workspaceTimezone?: string;
  /** Pre-fetched client list — avoids per-keystroke API calls in ClientStep. */
  clients?: ClientHit[];
  /** Called after a new client is successfully created via this wizard. */
  onClientCreated?: () => void;
  /** Called on every close path (cancel, save, backdrop, Escape).
   *  When provided, the parent owns the "is open" gate — the modal still
   *  manages its own animation state via Dialog's open/onOpenChange. */
  onClose?: () => void;
  /** Default team id for the new booking (create mode only). When there is
   *  exactly one writable team this is pre-selected; otherwise the user picks
   *  from the `teams` list in the event step. */
  teamId?: string;
  /** Writable teams the current user may assign new bookings to. Rendered as
   *  a selector in the event step (create mode only). */
  teams?: { id: string; name: string }[];
};

type StepDef = {
  id: "client" | "eventPricing" | "sessionsLocation" | "review";
  fields: (keyof WizardValues | "amount.total" | "amount.deposit")[];
};

const ALL_STEPS: StepDef[] = [
  { id: "client", fields: ["client"] },
  { id: "eventPricing", fields: ["title", "eventType", "teamId", "amount", "location"] },
  { id: "sessionsLocation", fields: ["sessions"] },
  { id: "review", fields: [] },
];

const MULTI_SESSION_STEPS: StepDef[] = [
  { id: "eventPricing", fields: ["title", "eventType", "amount", "location"] },
  { id: "sessionsLocation", fields: ["sessions"] },
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
  workspaceTimezone,
  clients,
  onClientCreated,
  onClose,
  teamId,
  teams,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.wizard");
  const tDnd = useTranslations("app.bookings.dnd");
  const errMsg = useActionError();
  const [, startTransition] = useTransition();

  const [open, setOpen] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit" && !initialValues);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conflictCheckError, setConflictCheckError] = useState(false);
  const [editClientName, setEditClientName] = useState<string | undefined>(
    initialValues?.client?.mode === "existing"
      ? initialValues.client.clientName
      : undefined
  );
  /** Email shown in the multi-session client sub-line (display only). */
  const [editClientEmail, setEditClientEmail] = useState<string | null>(null);
  /** Number of sessions on the booking being edited. Determines step list. */
  const [editSessionCount, setEditSessionCount] = useState<number>(
    initialValues?.sessions?.length ?? 1
  );
  /** Incrementing id for in-flight conflict-check requests; stale results are discarded. */
  const reqIdRef = useRef(0);
  /** Steps that have failed validation since the user last interacted with
   *  them. Drives the red-asterisk + shake markers in the header. */
  const [stepErrors, setStepErrors] = useState<Set<number>>(new Set());
  /** Pulsed for one frame whenever the user clicks a disallowed step or hits
   *  Next without passing validation. Drives the shake animation. */
  const [shakeKey, setShakeKey] = useState(0);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  /** Raw shifts keyed by YYYY-MM-DD date string. Treated as a cache — entries
   *  are added on demand and never evicted (harmless small footprint). */
  const [rawShiftsByDate, setRawShiftsByDate] = useState<Record<string, ShiftHit[]>>({});
  /** Mirror of rawShiftsByDate in a ref so the fetch effect can read cached keys
   *  without adding rawShiftsByDate to its dependency array (which would re-trigger
   *  the effect on every cache write, defeating the cache). */
  const rawShiftsByDateRef = useRef<Record<string, ShiftHit[]>>({});
  /** Dates currently being fetched — only in-flight (uncached) dates appear here.
   *  Used to disable Next and show inline loaders. */
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set());
  // Effective IANA timezone for wall-clock → UTC conversion. Falls back to
  // the launch-market default when the workspace has not set a TZ yet.
  const tz = workspaceTimezone || FALLBACK_TZ;

  const defaults = useMemo(
    () => makeDefaults({ defaultDate, defaultTime, defaultCurrency, initialValues, defaultTeamId: teamId }),
    [defaultDate, defaultTime, defaultCurrency, initialValues, teamId]
  );

  /**
   * In edit mode, `defaults` is computed once (initialValues is undefined →
   * empty sessions). After the async fetch resolves and form.reset(next) fires,
   * this ref updates so buildEditDiff compares against actual fetched values
   * rather than the empty initial defaults.
   */
  const defaultsRef = useRef<WizardValues>(defaults);

  const form = useForm<WizardValues>({
    defaultValues: defaults,
    mode: "onChange",
  });

  /**
   * Strips both wizard-related URL params regardless of which close path ran.
   * Defined early so it can be referenced in the edit-fetch error handler and
   * any other async callback below without stale-closure issues.
   */
  const clearWizardUrlParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    if (params.has("edit")) { params.delete("edit"); changed = true; }
    if (params.has("detail")) { params.delete("detail"); changed = true; }
    if (changed) {
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }
  }, [router, pathname, searchParams]);

  // Edit mode: fetch the booking and reset the form with its values.
  useEffect(() => {
    if (mode !== "edit" || !bookingId || initialValues) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (cancelled) return;
        if (!b) {
          // API returned a non-ok status (404, 403, etc.) — treat as load error.
          setLoading(false);
          setLoadError(t("loadError") || "Couldn't load this booking. Please close and try again.");
          if (!onClose) clearWizardUrlParams();
          return;
        }
        const rawSessions: { startAt: string; endAt: string }[] =
          Array.isArray(b.sessions) && b.sessions.length > 0
            ? b.sessions
            : [];
        const today = new Date().toISOString().slice(0, 10);
        // In edit mode: order existing sessions chronologically so they read
        // top-to-bottom by date. Create mode keeps insertion order because
        // the user's workflow may have implicit meaning.
        const sessionsForForm = [...rawSessions].sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        );
        const wizardSessions = sessionsForForm.map((s) => {
          const sd = new Date(s.startAt);
          const ed = new Date(s.endAt);
          const startDate = sd.toISOString().slice(0, 10);
          const startTime = `${String(sd.getHours()).padStart(2, "0")}:${String(sd.getMinutes()).padStart(2, "0")}`;
          const endTime = `${String(ed.getHours()).padStart(2, "0")}:${String(ed.getMinutes()).padStart(2, "0")}`;
          return {
            startDate,
            startTime,
            endTime,
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
          status: b.status ?? "booked",
          sessions:
            wizardSessions.length > 0
              ? wizardSessions
              : [{ startDate: "", startTime: "10:00", endTime: "17:00", allowPastDate: false }],
          location: {
            address: b.location?.address ?? "",
            lat: b.location?.lat ?? null,
            lng: b.location?.lng ?? null,
          },
          amount: {
            total: b.amount?.total ?? 0,
            deposit: b.amount?.deposit ?? 0,
            currency: b.amount?.currency ?? defaultCurrency,
          },
          notes: b.notes ?? "",
          teamId: b.teamId ?? "",
        };
        form.reset(next);
        // Sync the baseline so buildEditDiff compares against fetched values,
        // not the empty defaults computed before the fetch resolved.
        defaultsRef.current = next;
        setEditClientName(b.clientName ?? undefined);
        setEditClientEmail(b.clientEmail ?? null);
        setEditSessionCount(rawSessions.length);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[booking-wizard] failed to load booking", { bookingId, err });
        setLoading(false);
        setLoadError(t("loadError") || "Couldn't load this booking. Please close and try again.");
        // Strip the stale ?edit= param so it can't block a fresh open attempt.
        if (!onClose) {
          clearWizardUrlParams();
        }
      });
    return () => {
      cancelled = true;
    };
  // clearWizardUrlParams and onClose are stable across the booking's lifetime.
  // They're intentionally excluded from the dep array — the effect should only
  // re-run when the booking identity changes (mode/bookingId), not when URL state
  // or parent callbacks update. The `cancelled` flag guards against stale closures.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bookingId, initialValues, defaultCurrency, form, t]);

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
  // useWatch triggers re-renders on individual subfield changes (e.g. sessions.0.startDate),
  // whereas watch("sessions") only fires on array-level mutations (append/remove).
  const watchedSessions = useWatch({ control, name: "sessions" });
  const sessionDates = useMemo(
    () => (watchedSessions ?? []).map((s) => s.startDate),
    [watchedSessions]
  );

  // Fetch shifts for new startDates only. Uses rawShiftsByDateRef as a read-only
  // cache key-check so we don't re-fetch already-known dates. Only new (uncached)
  // dates are marked loading. Results are merged into the existing cache rather
  // than replacing it. An incrementing request id discards stale responses.
  useEffect(() => {
    const uniqueDates = [...new Set(sessionDates.filter(isValidDateString))];
    if (uniqueDates.length === 0) return;

    // Skip dates already in the cache — only fetch genuinely new ones.
    const datesToFetch = uniqueDates.filter(
      (d) => !(d in rawShiftsByDateRef.current)
    );
    if (datesToFetch.length === 0) return;

    const myId = ++reqIdRef.current;
    let cancelled = false;

    // Mark only in-flight (uncached) dates as loading.
    setLoadingDates(new Set(datesToFetch));

    Promise.all(
      datesToFetch.map(async (date) => {
        const params = new URLSearchParams({ date });
        if (mode === "edit" && bookingId) params.set("excludeId", bookingId);
        try {
          const r = await fetch(
            `/api/bookings/shifts-on-date?${params.toString()}`
          );
          if (!r.ok) {
            // Non-2xx treated as check unavailable — return null sentinel.
            return [date, null] as const;
          }
          const data: { shifts: ShiftHit[] } = await r.json();
          return [date, data.shifts ?? []] as const;
        } catch {
          return [date, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled || myId !== reqIdRef.current) return;
      const hasError = entries.some(([, v]) => v === null);
      if (hasError) {
        // A new date failed — set the error flag. Cached good dates remain.
        setConflictCheckError(true);
      } else {
        setConflictCheckError(false);
        // Merge new results into the existing cache rather than overwriting.
        setRawShiftsByDate((prev) => {
          const next = {
            ...prev,
            ...Object.fromEntries(
              entries.map(([date, shifts]) => [date, shifts as ShiftHit[]])
            ),
          };
          // Keep the ref in sync so the next effect run can read the latest cache.
          rawShiftsByDateRef.current = next;
          return next;
        });
      }
      setLoadingDates(new Set());
    });

    return () => {
      cancelled = true;
      setLoadingDates(new Set());
    };
  // rawShiftsByDateRef is intentionally omitted — it's a ref, not reactive state.
  // rawShiftsByDate is omitted to avoid re-running the effect on every cache write.
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

  // Multi-session edits drop the Client step — client is immutable there.
  const isMultiSessionEdit = mode === "edit" && editSessionCount > 1;
  const STEPS = isMultiSessionEdit ? MULTI_SESSION_STEPS : ALL_STEPS;

  const close = useCallback(() => {
    setOpen(false);
    // If the parent owns the open gate, delegate cleanup to it.
    if (onClose) {
      onClose();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("add");
    params.delete("date");
    params.delete("time");
    params.delete("edit");
    params.delete("detail");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [router, pathname, searchParams, onClose]);

  // Defensive unmount cleanup: if the component unmounts without close() having
  // run (e.g. error boundary, parent re-render, browser back), strip the params.
  useEffect(() => {
    return () => {
      // Only clean up if we actually own the URL (no onClose parent handler).
      if (!onClose) {
        clearWizardUrlParams();
      }
    };
    // clearWizardUrlParams captures router/pathname/searchParams at effect
    // creation time — that's intentional; we only need to run on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Validates a single step's fields. Returns true if the step is good. */
  async function validateStep(index: number): Promise<boolean> {
    const step = STEPS[index];
    const fieldPaths = step.fields as (keyof WizardValues)[];
    const rhfOk =
      fieldPaths.length === 0 ? true : await trigger(fieldPaths);
    if (step.id === "client") {
      // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form watch() is non-memoizable; React Compiler skips this component intentionally
      const client = watch("client");
      if (
        (client.mode === "existing" && !client.clientId) ||
        (client.mode === "new" && !client.name.trim())
      ) {
        return false;
      }
    }
    if (step.id === "eventPricing") {
      const title = watch("title");
      if (!title?.trim()) return false;
      // In create mode, a team must be selected.
      if (mode === "create" && !watch("teamId")) return false;
      const { total, deposit } = watch("amount");
      if (typeof total !== "number" || total < 0) return false;
      if (typeof deposit !== "number" || deposit < 0) return false;
      if (deposit > total) return false;
      // Location is required — must have a committed (non-empty) address.
      const location = watch("location");
      if (!location?.address?.trim()) return false;
    }
    if (step.id === "sessionsLocation") {
      const sessions = watch("sessions") ?? [];
      // Sessions must be non-empty and every session must have a start date.
      if (sessions.length === 0 || sessions.some((s) => !s.startDate)) return false;
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
      // Event & Pricing's specific "deposit > total" surfaces as a top-of-footer error.
      if (STEPS[stepIndex].id === "eventPricing") {
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

  const fireSubmit = useCallback(async (values: WizardValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (mode === "create") {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildCreatePayload(values, tz)),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(errMsg(data.error, data.params));
        }
        toast.success(t("createdToast"));
        // If a new client was created, notify the parent so it can refresh
        // its client list without a full page reload.
        if (values.client.mode === "new") {
          onClientCreated?.();
        }
      } else {
        if (!bookingId) throw new Error("Missing booking id");
        const diff = buildEditDiff(values, defaultsRef.current, tz);
        // For single-session edits, include clientId when the client was changed.
        const defaultClient = defaultsRef.current.client;
        const defaultClientId =
          defaultClient?.mode === "existing" ? defaultClient.clientId : undefined;
        if (
          !isMultiSessionEdit &&
          values.client.mode === "existing" &&
          values.client.clientId &&
          values.client.clientId !== defaultClientId
        ) {
          diff.clientId = values.client.clientId;
        }
        if (Object.keys(diff).length === 0) {
          // No-op submit — just close (URL cleanup happens inside close()).
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
          throw new Error(errMsg(data.error, data.params));
        }
        toast.success(t("savedToast"));
      }
      startTransition(() => router.refresh());
      // Success path: close() strips URL params before the router refresh lands.
      close();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : errMsg(null));
      // Failed submit: strip URL params so the stale ?edit= doesn't persist if
      // the user navigates away after seeing the error.
      if (!onClose) {
        clearWizardUrlParams();
      }
    } finally {
      setSubmitting(false);
    }
  }, [mode, bookingId, t, close, onClientCreated, isMultiSessionEdit, onClose, clearWizardUrlParams, router, tz]);

  const eventStepIndex = STEPS.findIndex((s) => s.id === "sessionsLocation");

  /**
   * Single source of truth for submit readiness.
   *
   * Returns { ok: true } when the form may be submitted, or
   * { ok: false, reason: "loading" | "error" | "conflict" } when it must be
   * blocked. Both onSubmit and saveFromAnywhere must call this before proceeding.
   */
  function canSubmit():
    | { ok: true }
    | { ok: false; reason: "loading" | "error" | "conflict" } {
    if (loadingDates.size > 0) return { ok: false, reason: "loading" };
    if (conflictCheckError) return { ok: false, reason: "error" };
    if (conflictsBySession.some((c) => c.length > 0))
      return { ok: false, reason: "conflict" };
    return { ok: true };
  }

  /** Surfaces the appropriate toast and marks the event step as invalid. */
  function blockOnConflict(reason: "loading" | "error" | "conflict") {
    setStepErrors((prev) => new Set(prev).add(eventStepIndex));
    setShakeKey((k) => k + 1);
    if (reason === "loading") {
      toast.info(t("event.checkingConflicts"));
    } else if (reason === "error") {
      toast.error(tDnd("conflictCheckFailed"));
    } else {
      toast.error(tDnd("conflictBlockSubmit"));
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    // Defense in depth: block submit if conflict fetch is in-flight, errored,
    // or returned actual conflicts. The Next button on the event step enforces
    // the same guard, but onSubmit must be independently safe.
    const guard = canSubmit();
    if (!guard.ok) {
      blockOnConflict(guard.reason);
      return;
    }
    await fireSubmit(values);
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
    // Guard: block if conflict fetch is unresolved or errored — same gate as onSubmit.
    const guard = canSubmit();
    if (!guard.ok) {
      blockOnConflict(guard.reason);
      return;
    }
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
  // Single-session edits now show the full picker; multi-session edits drop
  // the Client step entirely (handled above via STEPS selection).
  const isReadOnlyClient = false;
  const values = watch();

  return (
    <Dialog open={open} onOpenChange={attemptClose}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4em)] w-full max-w-2xl flex-col gap-0 p-0 transition-[max-height,width] duration-200 ease-out sm:max-w-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-col gap-1">
            <DialogTitle className="flex items-center gap-2">
              {mode === "create" ? (
                t("createTitle")
              ) : (
                <>
                  <span className="truncate">
                    {values.title ? t("editTitleNamed", { title: values.title }) : t("editTitle")}
                  </span>
                  {!loading && values.status ? <StatusPill status={values.status} /> : null}
                </>
              )}
            </DialogTitle>
            {isMultiSessionEdit && editClientName ? (
              <p className="text-xs text-muted-foreground">
                {t("client.readOnlyLabel")}: {editClientName}
                {editClientEmail ? ` · ${editClientEmail}` : ""}
              </p>
            ) : null}
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
          <div className="flex flex-1 flex-col gap-3 px-4 py-3 transition-[padding] duration-200 ease-out">
            {loading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("loading")}
              </p>
            ) : null}
            {loadError ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => attemptClose(false)}>
                  {t("cancel")}
                </Button>
              </div>
            ) : null}
            {!loading && !loadError ? (
              <div
                key={current.id}
                className="flex flex-col gap-3 animate-in fade-in-0 slide-in-from-right-1 duration-200"
              >
                {current.id === "client" ? (
                  <ClientStep
                    control={control}
                    errors={errors}
                    readOnly={isReadOnlyClient}
                    readOnlyClientName={editClientName}
                    clients={clients}
                  />
                ) : null}
                {current.id === "eventPricing" ? (
                  <EventPricingStep
                    control={control}
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                    teams={teams}
                    mode={mode}
                    locationSubmitted={stepErrors.has(STEPS.findIndex((s) => s.id === "eventPricing"))}
                  />
                ) : null}
                {current.id === "sessionsLocation" ? (
                  <SessionsLocationStep
                    control={control}
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                    conflictsBySession={conflictsBySession}
                    loadingDates={loadingDates}
                    conflictCheckError={conflictCheckError}
                  />
                ) : null}
                {current.id === "review" ? (
                  <ReviewStep values={values} locale={locale} teams={teams} />
                ) : null}
              </div>
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
                    disabled={
                      submitting ||
                      !!loadError ||
                      (STEPS[stepIndex].id === "sessionsLocation" &&
                        (loadingDates.size > 0 ||
                          conflictCheckError ||
                          conflictsBySession.some((c) => c.length > 0)))
                    }
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
                    disabled={
                      submitting ||
                      !!loadError ||
                      (mode === "edit" && !isDirty) ||
                      (mode === "create" && !values.teamId)
                    }
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
  defaultTeamId,
}: {
  defaultDate?: string;
  defaultTime?: string;
  defaultCurrency: SupportedCurrency;
  initialValues?: Partial<WizardValues>;
  defaultTeamId?: string;
}): WizardValues {
  const now = new Date();
  const today = todayIso(now);

  // When no explicit time was provided and the default start date is today,
  // snap to the next 30-min slot after now and adjust end time to preserve
  // the default 7-hour duration.
  let resolvedStartDate = defaultDate ?? "";
  let resolvedStartTime = defaultTime ?? "10:00";
  let resolvedEndTime = "17:00";

  if (!defaultTime && defaultDate && defaultDate === today) {
    const snapped = applyTodaySnap({
      prevStartDate: defaultDate,
      prevStartTime: "10:00",
      prevEndDate: "",
      prevEndTime: "17:00",
      now,
    });
    resolvedStartDate = snapped.startDate;
    resolvedStartTime = snapped.startTime;
    resolvedEndTime = snapped.endTime;
  }

  const defaultSession = {
    startDate: resolvedStartDate,
    startTime: resolvedStartTime,
    endTime: resolvedEndTime,
    allowPastDate: defaultDate ? defaultDate < today : false,
  };

  return {
    client:
      initialValues?.client ??
      ({ mode: "existing", clientId: "", clientName: "" } as const),
    title: initialValues?.title ?? "",
    eventType: initialValues?.eventType ?? "other",
    status: initialValues?.status ?? "booked",
    sessions:
      initialValues?.sessions && initialValues.sessions.length > 0
        ? initialValues.sessions
        : [defaultSession],
    location: initialValues?.location ?? { address: "", lat: null, lng: null },
    amount: {
      total: initialValues?.amount?.total ?? 0,
      deposit: initialValues?.amount?.deposit ?? 0,
      currency: initialValues?.amount?.currency ?? defaultCurrency,
    },
    notes: initialValues?.notes ?? "",
    teamId: initialValues?.teamId ?? defaultTeamId ?? "",
  };
}

function sessionsToPayload(
  sessions: WizardValues["sessions"],
  timeZone: string
): { startAt: string; endAt: string }[] {
  return sessions.map((s) => ({
    startAt: wallTimeInTzToUtc(s.startDate, s.startTime, timeZone),
    endAt: wallTimeInTzToUtc(s.startDate, s.endTime, timeZone),
  }));
}

function buildCreatePayload(v: WizardValues, timeZone: string) {
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
    sessions: sessionsToPayload(v.sessions, timeZone),
    location: {
      address: v.location.address,
      lat: v.location.lat,
      lng: v.location.lng,
    },
    amount: {
      total: v.amount.total,
      deposit: v.amount.deposit,
      currency: v.amount.currency,
    },
    notes: v.notes,
    teamId: v.teamId || undefined,
  };
}

function buildEditDiff(
  v: WizardValues,
  defaults: WizardValues,
  timeZone: string
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
    diff.sessions = sessionsToPayload(v.sessions, timeZone);
  }

  if (v.location.address !== defaults.location.address)
    diff["location.address"] = v.location.address;
  if (v.location.lat !== defaults.location.lat)
    diff["location.lat"] = v.location.lat;
  if (v.location.lng !== defaults.location.lng)
    diff["location.lng"] = v.location.lng;
  if (v.amount.total !== defaults.amount.total)
    diff["amount.total"] = v.amount.total;
  if (v.amount.deposit !== defaults.amount.deposit)
    diff["amount.deposit"] = v.amount.deposit;
  if (v.amount.currency !== defaults.amount.currency)
    diff["amount.currency"] = v.amount.currency;
  if (v.notes !== defaults.notes) diff.notes = v.notes;
  // Only include teamId when it actually changed and is non-empty.
  if (v.teamId !== defaults.teamId && v.teamId) diff.teamId = v.teamId;
  return diff;
}

/** Parse "HH:MM" → minutes since midnight, or null for malformed input. */
function toMinutes(hhmm: string | undefined | null): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Returns true only for a well-formed, calendar-valid YYYY-MM-DD string.
 * Round-trip check catches out-of-range values like "2025-13-45" or "2025-02-30".
 * Uses explicit UTC midnight (T00:00:00Z) so the check is timezone-invariant —
 * local-time construction would shift the date back in UTC+N zones and cause the
 * round-trip to fail for valid dates near midnight.
 */
function isValidDateString(s: string): boolean {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === s;
}

// Re-export for the page wrapper.
export type { WizardValues };
