"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AlertTriangleIcon } from "lucide-react";
import { EditableField } from "./editable-field";
import { CancelConfirmDialog } from "./cancel-confirm-dialog";
import { BookingHistoryDialog } from "./booking-history-dialog";
import { SessionEditConfirmDialog } from "./session-edit-confirm-dialog";
import type { ActivityEntry } from "./activity-types";
import type { ShiftHit } from "./booking-wizard-steps/event-step";
import {
  BOOKING_STATUSES,
  EVENT_TYPES,
  type EditableKey,
} from "@/lib/validators/booking";
import { SUPPORTED_CURRENCIES } from "@/lib/validators/workspace";
import { formatMoney } from "@/lib/utils/format-currency";
import {
  countDays,
  countPastDays,
  shiftSession,
  shiftSessionTimes,
  splitDayOut,
  type Session,
} from "@/lib/bookings/session-edits";
import { cn } from "@/lib/utils";

type SessionDoc = { startAt: string; endAt: string };

type BookingDoc = {
  _id: string;
  title: string;
  clientName: string;
  eventType: string;
  status: string;
  sessions: SessionDoc[];
  firstSessionStart: string;
  lastSessionEnd: string;
  location: { address: string };
  amount: { total: number; deposit: number; currency: string };
  notes: string;
};

type Props = {
  bookingId: string;
  locale: string;
};

type PendingChanges = Record<string, string | number | null>;

/**
 * Describes an in-flight session edit that requires confirmation before commit.
 * Only created when the session spans >1 day AND the edit is time-only (date
 * unchanged). Date-shift edits on multi-day sessions skip the dialog and apply
 * shiftSession directly — "this day only" doesn't make semantic sense when the
 * date itself moved.
 */
type PendingSessionEdit = {
  sessionIdx: number;
  originalSession: Session;
  newSession: Session;
  /** "time" = only HH:MM changed; "date" | "both" = date changed → no dialog */
  kind: "time" | "date" | "both";
} | null;

const NESTED_TO_DOTTED: Record<string, EditableKey> = {
  "location.address": "location.address",
  "amount.total": "amount.total",
  "amount.deposit": "amount.deposit",
  "amount.currency": "amount.currency",
};

export function BookingDetailModal({ bookingId, locale }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.detail");
  const tDnd = useTranslations("app.bookings.dnd");
  const [, startTransition] = useTransition();

  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDoc | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [pending, setPending] = useState<PendingChanges>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [pendingSessionEdit, setPendingSessionEdit] =
    useState<PendingSessionEdit>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  /** Existing shifts on the effective start date (excluding this booking). */
  const [conflicts, setConflicts] = useState<ShiftHit[]>([]);

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("detail");
    const qs = params.toString();
    setOpen(false);
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }, [router, pathname, searchParams]);

  const refetchInlineActivity = useCallback(async () => {
    const res = await fetch(
      `/api/bookings/${bookingId}/activity?page=1&pageSize=5`
    ).catch(() => null);
    if (!res || !res.ok) return;
    const data = (await res.json().catch(() => null)) as
      | { entries: ActivityEntry[]; total: number }
      | null;
    if (!data) return;
    setActivity(data.entries ?? []);
    setActivityTotal(data.total ?? 0);
  }, [bookingId]);

  useEffect(() => {
    let cancelled = false;
    // Reset + fetch in the async path so no synchronous setState fires in the
    // effect body (avoids react-hooks/set-state-in-effect).
    Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoading(true);
        setSaveError(null);
        setPending({});
        return Promise.all([
          fetch(`/api/bookings/${bookingId}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/bookings/${bookingId}/activity?page=1&pageSize=5`).then((r) =>
            r.ok ? r.json() : { entries: [], total: 0 }
          ),
        ]);
      })
      .then((results) => {
        if (!results || cancelled) return;
        const [b, a] = results;
        setBooking(b);
        setActivity(a?.entries ?? []);
        setActivityTotal(a?.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const effectiveStart = booking?.sessions?.[0]?.startAt ?? "";
  const effectiveEnd = booking?.sessions?.[0]?.endAt ?? "";
  const effectiveStartDate = effectiveStart ? isoDate(effectiveStart) : "";
  const effectiveStartTime = effectiveStart ? hhmm(effectiveStart) : "";
  const effectiveEndTime = effectiveEnd ? hhmm(effectiveEnd) : "";

  useEffect(() => {
    let cancelled = false;
    const date = effectiveStartDate;
    const id = bookingId;
    const params = date ? new URLSearchParams({ date, excludeId: id }) : null;
    Promise.resolve()
      .then(() => {
        if (cancelled) return;
        if (!params) {
          setConflicts([]);
          return;
        }
        return fetch(`/api/bookings/shifts-on-date?${params.toString()}`)
          .then((r) => (r.ok ? r.json() : { shifts: [] }))
          .then((data: { shifts: ShiftHit[] }) => {
            if (cancelled) return;
            setConflicts(data.shifts ?? []);
          })
          .catch(() => {
            if (cancelled) return;
            setConflicts([]);
          });
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveStartDate, bookingId]);

  const actualConflicts = useMemo(() => {
    if (conflicts.length === 0) return conflicts;
    const aStart = toMinutes(effectiveStartTime);
    const aEnd = toMinutes(effectiveEndTime);
    if (aStart == null || aEnd == null || aEnd <= aStart) return conflicts;
    return conflicts.filter((c) => {
      const bStart = toMinutes(c.shiftStart);
      const bEnd = toMinutes(c.shiftEnd);
      if (bStart == null || bEnd == null) return false;
      return aStart < bEnd && bStart < aEnd;
    });
  }, [conflicts, effectiveStartTime, effectiveEndTime]);

  function prependOptimisticActivity(
    action: "updated" | "status_changed" | "created",
    changes: Record<string, { before: unknown; after: unknown }>
  ) {
    const entry: ActivityEntry = {
      _id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      createdAt: new Date().toISOString(),
      diff: { changes },
    };
    setActivity((prev) => [entry, ...prev].slice(0, 5));
    setActivityTotal((n) => n + 1);
  }

  const pendingCount = Object.keys(pending).length;
  const hasPending = pendingCount > 0;

  function commitField(key: EditableKey, value: string | number | null) {
    setPending((prev) => {
      const next = { ...prev };
      const current = getCurrentValue(booking, key);
      if (value === current) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  function discardField(key: EditableKey) {
    setPending((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function discardAll() {
    setPending({});
    setSaveError(null);
  }

  async function save() {
    if (!hasPending || !booking) return;
    if (actualConflicts.length > 0) {
      setSaveError(t("conflictBlocksSave"));
      toast.error(t("conflictBlocksSave"));
      return;
    }
    setSaving(true);
    setSaveError(null);

    const previous = booking;
    const previousActivity = activity;
    const previousTotal = activityTotal;
    const optimistic = applyChanges(booking, pending);
    setBooking(optimistic);

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, value] of Object.entries(pending)) {
      const before = getCurrentValue(previous, key as EditableKey);
      changes[key] = { before, after: value };
    }
    prependOptimisticActivity(
      "status" in pending ? "status_changed" : "updated",
      changes
    );

    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pending),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      const updated: BookingDoc = await res.json();
      setBooking(updated);
      setPending({});
      toast.success(t("savedToast"));
      startTransition(() => router.refresh());
      await refetchInlineActivity();
    } catch (err) {
      setBooking(previous);
      setActivity(previousActivity);
      setActivityTotal(previousTotal);
      const msg = err instanceof Error ? err.message : "Couldn't save";
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Patches the booking with a new full sessions array.
   * Used by session add/remove and all inline session edits.
   */
  async function patchSessions(newSessions: SessionDoc[]) {
    if (!booking) return;
    setSaving(true);
    const previous = booking;
    const previousActivity = activity;
    const previousTotal = activityTotal;

    const optimistic: BookingDoc = {
      ...booking,
      sessions: newSessions,
      firstSessionStart: newSessions[0]?.startAt ?? booking.firstSessionStart,
      lastSessionEnd:
        newSessions[newSessions.length - 1]?.endAt ?? booking.lastSessionEnd,
    };
    setBooking(optimistic);
    prependOptimisticActivity("updated", {
      sessions: { before: previous.sessions, after: newSessions },
    });

    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessions: newSessions }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      const updated: BookingDoc = await res.json();
      setBooking(updated);
      toast.success(t("savedToast"));
      startTransition(() => router.refresh());
      await refetchInlineActivity();
    } catch (err) {
      setBooking(previous);
      setActivity(previousActivity);
      setActivityTotal(previousTotal);
      const msg = err instanceof Error ? err.message : "Couldn't save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Called when a session card commits an edit.
   * For single-day sessions: patch immediately.
   * For multi-day + time-only edits: open the confirm dialog.
   * For multi-day + date edits: apply shiftSession directly (skip dialog —
   * "apply to this day only" has no clear meaning when the date itself moved).
   */
  function handleSessionCommit(
    sessionIdx: number,
    newSession: Session,
    kind: "time" | "date" | "both"
  ) {
    if (!booking) return;
    const original = booking.sessions[sessionIdx];
    if (!original) return;

    const originalSession: Session = {
      startAt: new Date(original.startAt),
      endAt: new Date(original.endAt),
    };

    const days = countDays(originalSession);

    if (days <= 1) {
      // Single-day: apply immediately, no prompt.
      const updated = booking.sessions.map((s, i) =>
        i === sessionIdx ? sessionToDoc(newSession) : s
      );
      void patchSessions(updated);
      return;
    }

    if (kind === "time") {
      // Multi-day, time-only edit: ask the user which scope to apply.
      setPendingSessionEdit({ sessionIdx, originalSession, newSession, kind });
      setSessionDialogOpen(true);
      return;
    }

    // Multi-day, date changed: apply shiftSession for the whole session with
    // past-day protection. "This day only" doesn't make sense when the date moved.
    const today = new Date();
    const shiftMs =
      newSession.startAt.getTime() - originalSession.startAt.getTime();
    const result = shiftSession(originalSession, shiftMs, today);
    if (result.length > 1) {
      toast.warning(tDnd("pastSplitWarning"));
    }
    const updated = booking.sessions.flatMap((s, i) =>
      i === sessionIdx ? result.map(sessionToDoc) : [s]
    );
    void patchSessions(updated);
  }

  function handleSessionApplyToDay() {
    if (!pendingSessionEdit || !booking) return;
    const { sessionIdx, originalSession, newSession } = pendingSessionEdit;
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    // "This day only" = split out the first day of the future portion with new times.
    // We pick the first future day of the session as "the touched day".
    // If the entire session is in the past, block the action.
    const sessionStart = new Date(
      originalSession.startAt.getFullYear(),
      originalSession.startAt.getMonth(),
      originalSession.startAt.getDate()
    );
    if (sessionStart < todayStart) {
      toast.error(tDnd("thisDayOnlyOnPast"));
      setSessionDialogOpen(false);
      setPendingSessionEdit(null);
      return;
    }

    const touchedDay = originalSession.startAt;
    const result = splitDayOut(originalSession, touchedDay, newSession.startAt, newSession.endAt);
    const updated = booking.sessions.flatMap((s, i) =>
      i === sessionIdx ? result.map(sessionToDoc) : [s]
    );
    setSessionDialogOpen(false);
    setPendingSessionEdit(null);
    void patchSessions(updated);
  }

  function handleSessionApplyToSession() {
    if (!pendingSessionEdit || !booking) return;
    const { sessionIdx, originalSession, newSession, kind } = pendingSessionEdit;
    const today = new Date();

    let result: Session[];
    if (kind === "time") {
      result = shiftSessionTimes(
        originalSession,
        newSession.startAt,
        newSession.endAt,
        today
      );
    } else {
      const shiftMs =
        newSession.startAt.getTime() - originalSession.startAt.getTime();
      result = shiftSession(originalSession, shiftMs, today);
    }

    if (result.length > 1) {
      toast.warning(tDnd("pastSplitWarning"));
    }
    const updated = booking.sessions.flatMap((s, i) =>
      i === sessionIdx ? result.map(sessionToDoc) : [s]
    );
    setSessionDialogOpen(false);
    setPendingSessionEdit(null);
    void patchSessions(updated);
  }

  function handleSessionDialogCancel() {
    setSessionDialogOpen(false);
    setPendingSessionEdit(null);
  }

  function handleAddSession() {
    if (!booking) return;
    const sessions = booking.sessions;
    const last = sessions[sessions.length - 1];
    let newStart: Date;
    let newEnd: Date;

    if (last) {
      const lastEnd = new Date(last.endAt);
      const nextDay = new Date(lastEnd);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(
        new Date(last.startAt).getHours(),
        new Date(last.startAt).getMinutes(),
        0,
        0
      );
      newStart = nextDay;
      const endTime = new Date(last.endAt);
      const endOfNextDay = new Date(nextDay);
      endOfNextDay.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
      newEnd = endOfNextDay;
    } else {
      const today = new Date();
      today.setHours(10, 0, 0, 0);
      newStart = today;
      const endDefault = new Date(today);
      endDefault.setHours(17, 0, 0, 0);
      newEnd = endDefault;
    }

    const newSession: SessionDoc = {
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
    };
    void patchSessions([...sessions, newSession]);
  }

  function handleRemoveSession(idx: number) {
    if (!booking) return;
    if (booking.sessions.length <= 1) return;
    const updated = booking.sessions.filter((_, i) => i !== idx);
    void patchSessions(updated);
  }

  function attemptClose(next: boolean) {
    if (next) return;
    if (hasPending) {
      if (!window.confirm(t("unsavedConfirm"))) return;
    }
    close();
  }

  async function applyStatusChange(newStatus: "cancelled" | "booked") {
    if (!booking) return;
    setSaving(true);
    const previous = booking;
    const previousActivity = activity;
    const previousTotal = activityTotal;
    setBooking({ ...booking, status: newStatus });
    prependOptimisticActivity("status_changed", {
      status: { before: previous.status, after: newStatus },
    });
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Action failed");
      const updated: BookingDoc = await res.json();
      setBooking(updated);
      toast.success(
        newStatus === "cancelled" ? t("cancelledToast") : t("restoredToast")
      );
      startTransition(() => router.refresh());
      await refetchInlineActivity();
    } catch {
      setBooking(previous);
      setActivity(previousActivity);
      setActivityTotal(previousTotal);
      toast.error(t("actionFailed"));
    } finally {
      setSaving(false);
    }
  }

  function requestCancel() {
    if (!booking) return;
    if (booking.status === "cancelled") {
      void applyStatusChange("booked");
    } else {
      setCancelDialogOpen(true);
    }
  }

  async function confirmCancel() {
    setCancelDialogOpen(false);
    await applyStatusChange("cancelled");
  }

  // Compute confirm-dialog props for the current pending session edit.
  const confirmDialogProps = useMemo(() => {
    if (!pendingSessionEdit) return { sessionDayCount: 1, pastDayCount: 0 };
    const days = countDays(pendingSessionEdit.originalSession);
    const pastDays = countPastDays(pendingSessionEdit.originalSession, new Date());
    return { sessionDayCount: days, pastDayCount: pastDays };
  }, [pendingSessionEdit]);

  return (
    <Dialog open={open} onOpenChange={attemptClose}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl"
      >
        <DialogHeaderBar
          booking={booking}
          pending={pending}
          loading={loading}
          locale={locale}
          onEditAll={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("detail");
            params.set("edit", bookingId);
            startTransition(() => {
              router.push(`${pathname}?${params.toString()}`);
            });
          }}
          onClose={() => attemptClose(false)}
        />

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <ModalSkeleton />
          ) : !booking ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("notFound")}
            </p>
          ) : (
            <BookingTabs
              booking={booking}
              activity={activity}
              activityTotal={activityTotal}
              pending={pending}
              locale={locale}
              onCommit={commitField}
              onDiscard={discardField}
              onViewAllHistory={() => setHistoryDialogOpen(true)}
              disabled={saving}
              conflicts={actualConflicts}
              onSessionCommit={handleSessionCommit}
              onAddSession={handleAddSession}
              onRemoveSession={handleRemoveSession}
            />
          )}
        </div>

        {booking ? (
          <DialogFooterBar
            cancelled={booking.status === "cancelled"}
            hasPending={hasPending}
            pendingCount={pendingCount}
            saving={saving}
            saveError={saveError}
            saveBlocked={actualConflicts.length > 0}
            onToggleCancel={requestCancel}
            onDiscard={discardAll}
            onSave={save}
          />
        ) : null}
      </DialogContent>

      <CancelConfirmDialog
        open={cancelDialogOpen}
        bookingTitle={booking?.title ?? ""}
        onCancel={() => setCancelDialogOpen(false)}
        onConfirm={confirmCancel}
        busy={saving}
      />

      <BookingHistoryDialog
        bookingId={bookingId}
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        locale={locale}
      />

      <SessionEditConfirmDialog
        open={sessionDialogOpen}
        sessionDayCount={confirmDialogProps.sessionDayCount}
        pastDayCount={confirmDialogProps.pastDayCount}
        onApplyToDay={handleSessionApplyToDay}
        onApplyToSession={handleSessionApplyToSession}
        onCancel={handleSessionDialogCancel}
        busy={saving}
      />
    </Dialog>
  );
}

// ─── DialogHeaderBar ────────────────────────────────────────────────────────

function DialogHeaderBar({
  booking,
  pending,
  loading,
  locale,
  onEditAll,
  onClose,
}: {
  booking: BookingDoc | null;
  pending: PendingChanges;
  loading: boolean;
  locale: string;
  onEditAll: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("app.bookings.detail.fields");
  const tDetail = useTranslations("app.bookings.detail");

  let outstanding = 0;
  let currency = "PHP";
  if (booking) {
    const total = (pending["amount.total"] as number) ?? booking.amount.total;
    const deposit =
      (pending["amount.deposit"] as number) ?? booking.amount.deposit;
    currency = (pending["amount.currency"] as string) ?? booking.amount.currency;
    outstanding = Math.max(0, (total ?? 0) - (deposit ?? 0));
  }
  const isOverdue = booking ? outstanding > 0 : false;

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {loading ? (
          <Skeleton className="h-5 w-48" />
        ) : (
          <DialogTitle className="truncate">{booking?.title ?? "—"}</DialogTitle>
        )}
        {booking ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="capitalize">
              {booking.status}
            </Badge>
            <span className="ml-1">{booking.clientName}</span>
            <span>·</span>
            <span>
              {booking.sessions?.[0]?.startAt
                ? new Date(booking.sessions[0].startAt).toLocaleDateString(
                    locale,
                    {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  )
                : "—"}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {booking ? (
          <Badge
            variant={isOverdue ? "default" : "outline"}
            className={
              "tabular-nums" +
              (isOverdue ? " bg-brand text-brand-foreground" : "")
            }
            title={t("outstanding")}
          >
            {t("outstanding")}: {formatMoney(outstanding, currency, locale)}
          </Badge>
        ) : null}
        {booking ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditAll}
          >
            <PencilIcon className="size-3.5" />
            {tDetail("editAll")}
          </Button>
        ) : null}
        <DialogClose
          render={
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <XIcon className="size-4" />
            </Button>
          }
        />
      </div>
    </div>
  );
}

// ─── BookingTabs ─────────────────────────────────────────────────────────────

function BookingTabs({
  booking,
  activity,
  activityTotal,
  pending,
  locale,
  onCommit,
  onDiscard,
  onViewAllHistory,
  disabled,
  conflicts,
  onSessionCommit,
  onAddSession,
  onRemoveSession,
}: {
  booking: BookingDoc;
  activity: ActivityEntry[];
  activityTotal: number;
  pending: PendingChanges;
  locale: string;
  onCommit: (key: EditableKey, value: string | number | null) => void;
  onDiscard: (key: EditableKey) => void;
  onViewAllHistory: () => void;
  disabled: boolean;
  conflicts: ShiftHit[];
  onSessionCommit: (
    idx: number,
    newSession: Session,
    kind: "time" | "date" | "both"
  ) => void;
  onAddSession: () => void;
  onRemoveSession: (idx: number) => void;
}) {
  const t = useTranslations("app.bookings.detail.tabs");
  const tFields = useTranslations("app.bookings.detail.fields");
  const tStatus = useTranslations("app.bookings.statusValues");
  const tEvent = useTranslations("app.bookings.eventTypes");
  const tSessions = useTranslations("app.bookings.sessions");

  const statusOptions = useMemo(
    () =>
      BOOKING_STATUSES.map((s) => ({
        value: s,
        label: safeT(tStatus, s, s),
      })),
    [tStatus]
  );

  const eventTypeOptions = useMemo(
    () =>
      EVENT_TYPES.map((e) => ({
        value: e,
        label: safeT(tEvent, e, e),
      })),
    [tEvent]
  );

  const currencyOptions = useMemo(
    () => SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c })),
    []
  );

  const get = (key: EditableKey) => ({
    hasPending: key in pending,
    pendingValue: (pending[key] ?? null) as string | number | null,
    value: getCurrentValue(booking, key) as string | number | null,
  });

  const currency =
    (pending["amount.currency"] as string) ?? booking.amount.currency;
  const total = (pending["amount.total"] as number) ?? booking.amount.total;

  const tSections = useTranslations("app.bookings.detail.sections");

  return (
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTab value="details">{t("details")}</TabsTab>
        <TabsTab value="activity">{t("activity")}</TabsTab>
      </TabsList>

      <TabsPanel value="details">
        <EditableField
          label={tFields("title")}
          type="text"
          {...get("title")}
          onCommit={(v) => onCommit("title", v)}
          onDiscardPending={() => onDiscard("title")}
          disabled={disabled}
          validate={(v) =>
            !v || String(v).trim() === "" ? tFields("titleRequired") : null
          }
        />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <EditableField
            label={tFields("clientName")}
            type="text"
            {...get("clientName")}
            onCommit={(v) => onCommit("clientName", v)}
            onDiscardPending={() => onDiscard("clientName")}
            disabled={disabled}
          />
          <EditableField
            label={tFields("status")}
            type="select"
            options={statusOptions}
            {...get("status")}
            onCommit={(v) => onCommit("status", v)}
            onDiscardPending={() => onDiscard("status")}
            disabled={disabled}
          />
        </div>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <EditableField
            label={tFields("eventType")}
            type="select"
            options={eventTypeOptions}
            {...get("eventType")}
            onCommit={(v) => onCommit("eventType", v)}
            onDiscardPending={() => onDiscard("eventType")}
            disabled={disabled}
          />
          <EditableField
            label={tFields("location")}
            type="text"
            {...get("location.address")}
            onCommit={(v) => onCommit("location.address", v)}
            onDiscardPending={() => onDiscard("location.address")}
            disabled={disabled}
          />
        </div>

        <SectionHeader label={tSections("schedule")} />

        {conflicts.length > 0 ? (
          <div className="mb-2 flex items-start gap-2 border border-destructive bg-destructive/10 px-3 py-2 text-xs">
            <AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold text-destructive">
                {tFields("conflictsLabel", {
                  date: new Date(
                    booking?.sessions?.[0]?.startAt ?? ""
                  ).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }),
                })}
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

        {/* Sessions list — inline-editable cards */}
        <div className="flex flex-col gap-2">
          {(booking?.sessions ?? []).map((s, idx) => (
            <SessionCard
              key={idx}
              session={s}
              total={booking.sessions.length}
              locale={locale}
              disabled={disabled}
              label={tSessions("label", { n: idx + 1 })}
              removeLabel={tSessions("remove")}
              onCommit={(newSession, kind) =>
                onSessionCommit(idx, newSession, kind)
              }
              onRemove={() => onRemoveSession(idx)}
            />
          ))}
        </div>

        {/* Add session */}
        <button
          type="button"
          onClick={onAddSession}
          disabled={disabled}
          className={cn(
            "mt-2 flex w-full items-center justify-center gap-1.5 border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors",
            "hover:border-foreground hover:text-foreground focus-visible:border-foreground focus-visible:text-foreground focus-visible:outline-none",
            "active:border-foreground active:text-foreground",
            "disabled:pointer-events-none disabled:opacity-50",
            "min-h-11"
          )}
        >
          <PlusIcon className="size-4" />
          {tSessions("add")}
        </button>

        <SectionHeader label={tSections("pricing")} />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <EditableField
            label={tFields("total")}
            type="money"
            currency={currency}
            formatDisplay={(v) => formatMoney(Number(v) || 0, currency, locale)}
            {...get("amount.total")}
            onCommit={(v) => onCommit("amount.total", v)}
            onDiscardPending={() => onDiscard("amount.total")}
            disabled={disabled}
          />
          <EditableField
            label={tFields("deposit")}
            type="money"
            currency={currency}
            formatDisplay={(v) => formatMoney(Number(v) || 0, currency, locale)}
            {...get("amount.deposit")}
            onCommit={(v) => onCommit("amount.deposit", v)}
            onDiscardPending={() => onDiscard("amount.deposit")}
            disabled={disabled}
            validate={(v) => {
              const n = Number(v);
              if (Number.isFinite(n) && n > total) {
                return tFields("depositExceedsTotal");
              }
              return null;
            }}
          />
          <EditableField
            label={tFields("currency")}
            type="select"
            options={currencyOptions}
            {...get("amount.currency")}
            onCommit={(v) => onCommit("amount.currency", v)}
            onDiscardPending={() => onDiscard("amount.currency")}
            disabled={disabled}
          />
        </div>
      </TabsPanel>

      <TabsPanel value="activity">
        <EditableField
          label={tFields("notes")}
          type="textarea"
          {...get("notes")}
          onCommit={(v) => onCommit("notes", v)}
          onDiscardPending={() => onDiscard("notes")}
          disabled={disabled}
        />

        <SectionHeader label={tSections("history")} />
        {activity.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {tFields("activityEmpty")}
          </p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {activity.slice(0, 5).map((entry) => (
                <li
                  key={entry._id}
                  className="flex items-start justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm capitalize">
                      {entry.action.replace("_", " ")}
                    </span>
                    {entry.diff?.changes ? (
                      <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {Object.entries(entry.diff.changes).map(([k]) => (
                          <li key={k} className="capitalize">
                            · {k.replace(".", " · ")}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {new Date(entry.createdAt).toLocaleString(locale, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
            {activityTotal > 5 ? (
              <button
                type="button"
                onClick={onViewAllHistory}
                className="mt-2 self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
              >
                {tFields("viewAllHistory", { count: activityTotal })}
              </button>
            ) : null}
          </>
        )}
      </TabsPanel>
    </Tabs>
  );
}

// ─── SessionCard ─────────────────────────────────────────────────────────────

/**
 * Inline-editable card for a single session.
 *
 * Uses its own local draft state rather than the global pending-changes map
 * because sessions are patched as a full array replacement — they don't fit
 * the key-indexed EditableField pattern used by scalar fields. Each card is
 * self-contained: the user edits, confirms/cancels inline, then the parent
 * decides what to send to the API.
 */
function SessionCard({
  session,
  total,
  locale,
  disabled,
  label,
  removeLabel,
  onCommit,
  onRemove,
}: {
  session: SessionDoc;
  total: number;
  locale: string;
  disabled: boolean;
  label: string;
  removeLabel: string;
  onCommit: (newSession: Session, kind: "time" | "date" | "both") => void;
  onRemove: () => void;
}) {
  const tFields = useTranslations("app.bookings.detail.fields");

  const startDate = isoDate(session.startAt);
  const startTime = hhmm(session.startAt);
  const endDate = isoDate(session.endAt);
  const endTime = hhmm(session.endAt);

  const [editing, setEditing] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [draftStartTime, setDraftStartTime] = useState(startTime);
  const [draftEndDate, setDraftEndDate] = useState(endDate);
  const [draftEndTime, setDraftEndTime] = useState(endTime);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync when the parent updates (e.g. after a PATCH settles).
  useEffect(() => {
    if (editing) return;
    // Defer to async so no synchronous setState fires in the effect body.
    const startAt = session.startAt;
    const endAt = session.endAt;
    Promise.resolve().then(() => {
      setDraftStartDate(isoDate(startAt));
      setDraftStartTime(hhmm(startAt));
      setDraftEndDate(isoDate(endAt));
      setDraftEndTime(hhmm(endAt));
      setError(null);
    });
  }, [session.startAt, session.endAt, editing]);

  function startEdit() {
    if (disabled) return;
    setDraftStartDate(isoDate(session.startAt));
    setDraftStartTime(hhmm(session.startAt));
    setDraftEndDate(isoDate(session.endAt));
    setDraftEndTime(hhmm(session.endAt));
    setError(null);
    setEditing(true);
    setTimeout(() => firstInputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setError(null);
    setEditing(false);
  }

  function commit() {
    const newStartAt = combineDatetime(draftStartDate, draftStartTime);
    const newEndAt = combineDatetime(draftEndDate, draftEndTime);
    if (!newStartAt || !newEndAt) {
      setError("Invalid date or time.");
      return;
    }
    const start = new Date(newStartAt);
    const end = new Date(newEndAt);
    if (end < start) {
      setError(tFields("endBeforeStart"));
      return;
    }
    setError(null);
    setEditing(false);

    // Determine what kind of edit this is to decide whether to show the dialog.
    const dateChanged =
      draftStartDate !== startDate || draftEndDate !== endDate;
    const timeChanged =
      draftStartTime !== startTime || draftEndTime !== endTime;
    let kind: "time" | "date" | "both";
    if (dateChanged && timeChanged) kind = "both";
    else if (dateChanged) kind = "date";
    else kind = "time";

    onCommit({ startAt: start, endAt: end }, kind);
  }

  const isOnlySession = total <= 1;

  return (
    <div className="border border-border bg-card text-card-foreground p-3">
      {/* Card header: label + edit/delete controls */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={commit}
                aria-label="Confirm"
                disabled={disabled}
              >
                <CheckIcon className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={cancelEdit}
                aria-label="Cancel"
              >
                <XIcon className="size-4" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={startEdit}
              disabled={disabled}
              aria-label={`Edit ${label}`}
            >
              <PencilIcon className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={isOnlySession ? undefined : onRemove}
            disabled={disabled || isOnlySession}
            aria-disabled={isOnlySession}
            title={isOnlySession ? removeLabel : undefined}
            aria-label={removeLabel}
            className={cn(
              "text-muted-foreground",
              !isOnlySession &&
                "hover:text-destructive focus-visible:text-destructive"
            )}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </div>

      {!editing ? (
        /* Read state: two columns on sm+ */
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {tFields("startAt")}
            </span>
            <span className="text-sm text-foreground">
              {session.startAt
                ? new Date(session.startAt).toLocaleString(locale, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {tFields("endAt")}
            </span>
            <span className="text-sm text-foreground">
              {session.endAt
                ? new Date(session.endAt).toLocaleString(locale, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          </div>
        </div>
      ) : (
        /* Edit state: date + time inputs for start and end */
        <div className="flex flex-col gap-3">
          {error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Start */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tFields("startAt")}
              </span>
              <div className="flex gap-2">
                <Input
                  ref={firstInputRef}
                  type="date"
                  value={draftStartDate}
                  onChange={(e) => setDraftStartDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="flex-1"
                />
                <Input
                  type="time"
                  value={draftStartTime}
                  onChange={(e) => setDraftStartTime(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="w-28"
                />
              </div>
            </div>
            {/* End */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tFields("endAt")}
              </span>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={draftEndDate}
                  onChange={(e) => setDraftEndDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="flex-1"
                />
                <Input
                  type="time"
                  value={draftEndTime}
                  onChange={(e) => setDraftEndTime(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="w-28"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SectionHeader ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mt-4 mb-1 flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

// ─── DialogFooterBar ─────────────────────────────────────────────────────────

function DialogFooterBar({
  cancelled,
  hasPending,
  pendingCount,
  saving,
  saveError,
  saveBlocked,
  onToggleCancel,
  onDiscard,
  onSave,
}: {
  cancelled: boolean;
  hasPending: boolean;
  pendingCount: number;
  saving: boolean;
  saveError: string | null;
  saveBlocked: boolean;
  onToggleCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const t = useTranslations("app.bookings.detail");
  return (
    <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3">
      {saveError ? (
        <p className="text-xs text-destructive">{saveError}</p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant={cancelled ? "outline" : "destructive"}
          size="sm"
          onClick={onToggleCancel}
          disabled={saving}
        >
          {cancelled ? t("restore") : t("cancel")}
        </Button>
        <div className="flex items-center gap-2">
          {hasPending ? (
            <>
              <span className="text-xs text-muted-foreground">
                {t("pendingBadge", { count: pendingCount })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDiscard}
                disabled={saving}
              >
                {t("discardChanges")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={saving || saveBlocked}
                className={cn(saving && "pointer-events-none")}
                title={saveBlocked ? t("conflictBlocksSave") : undefined}
              >
                {saving ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                {t("saveChanges")}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── ModalSkeleton ────────────────────────────────────────────────────────────

function ModalSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-2">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function isoDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hhmm(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function combineDatetime(date: string, time: string): string {
  if (!date) return "";
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return new Date(`${date}T${t}:00`).toISOString();
}

function toMinutes(hh: string | undefined | null): number | null {
  if (!hh || !/^\d{2}:\d{2}$/.test(hh)) return null;
  const [h, m] = hh.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function sessionToDoc(s: Session): SessionDoc {
  return {
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
  };
}

function getCurrentValue(booking: BookingDoc | null, key: EditableKey): unknown {
  if (!booking) return null;
  switch (key) {
    case "location.address":
      return booking.location?.address ?? "";
    case "amount.total":
      return booking.amount?.total ?? 0;
    case "amount.deposit":
      return booking.amount?.deposit ?? 0;
    case "amount.currency":
      return booking.amount?.currency ?? "PHP";
    default:
      return booking[key as keyof BookingDoc] ?? null;
  }
}

function applyChanges(booking: BookingDoc, changes: PendingChanges): BookingDoc {
  const next = structuredClone(booking) as BookingDoc;
  for (const [key, value] of Object.entries(changes)) {
    const k = key as EditableKey;
    if (k === "location.address") {
      next.location.address = String(value ?? "");
    } else if (k === "amount.total") {
      next.amount.total = Number(value) || 0;
    } else if (k === "amount.deposit") {
      next.amount.deposit = Number(value) || 0;
    } else if (k === "amount.currency") {
      next.amount.currency = String(value ?? "PHP");
    } else if (k in NESTED_TO_DOTTED) {
      // covered above
    } else {
      (next as Record<string, unknown>)[k] = value as unknown;
    }
  }
  return next;
}

function safeT(
  t: (key: string) => string,
  key: string,
  fallback: string
): string {
  try {
    const v = t(key);
    return v && v !== key ? v : fallback;
  } catch {
    return fallback;
  }
}
