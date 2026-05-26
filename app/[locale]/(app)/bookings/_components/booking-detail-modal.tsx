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
  EyeIcon,
  EyeOffIcon,
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
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

/** Pending edit for an existing session (keyed by session index in booking.sessions). */
type PendingSessionEdit = { startAt: Date; endAt: Date };

/** A session row that has been added locally but not yet persisted to the API. */
type DraftSession = {
  /** Stable key for React rendering — not sent to the API. */
  draftId: string;
  startAt: string;
  endAt: string;
  /**
   * When true the draft has been "confirmed" by the user (✓ clicked) and renders
   * in display mode like an existing SessionCard. The user can click ✏️ to re-open
   * the inline editor. Persisted only when the global Save is clicked.
   */
  locked: boolean;
};

/**
 * Describes an in-flight session edit that requires confirmation before commit.
 * Only created when the session spans >1 day AND the edit is time-only (date
 * unchanged). Date-shift edits on multi-day sessions skip the dialog and apply
 * shiftSession directly — "this day only" doesn't make semantic sense when the
 * date itself moved.
 */
type PendingSessionEditDialog = {
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
  /** Draft sessions appended by "Add session" — not yet persisted. */
  const [draftSessions, setDraftSessions] = useState<DraftSession[]>([]);
  /**
   * Pending edits for EXISTING sessions. Keyed by session index in booking.sessions.
   * Flushed in the global Save together with `pending` scalar changes.
   */
  const [pendingSessionEdits, setPendingSessionEdits] = useState<
    Record<number, PendingSessionEdit>
  >({});
  const [pendingSessionEditDialog, setPendingSessionEditDialog] =
    useState<PendingSessionEditDialog>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  /**
   * Confirm-discard dialog state — replaces window.confirm for close-with-unsaved.
   */
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  /**
   * Shifts keyed by YYYY-MM-DD date. Treated as a cache — entries are added on
   * demand and never evicted (harmless; small footprint). Each card derives its
   * own conflict list by looking up its current effective date in this map.
   */
  const [shiftsByDate, setShiftsByDate] = useState<Map<string, ShiftHit[]>>(
    new Map()
  );
  /** Dates currently being fetched for conflict check — used to show inline loading.
   *  Only contains dates that are genuinely in-flight, never cached dates. */
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set());
  /** Incrementing id for in-flight conflict-check requests; stale results are discarded. */
  const reqIdRef = useRef(0);
  /**
   * Mirror of shiftsByDate kept in a ref so the fetch effect can check cached
   * keys without adding shiftsByDate to its dependency array (which would
   * re-trigger the effect on every cache write, defeating the cache).
   */
  const shiftsByDateRef = useRef<Map<string, ShiftHit[]>>(new Map());

  /**
   * In-flight draft dates: tracks the date currently typed in an open session
   * editor before the user clicks ✓ (commit).
   *
   * Keys: session index (number as string) for existing sessions being edited,
   * or "draft:<draftIndex>" for in-progress new drafts.
   * Values: the YYYY-MM-DD date currently typed.
   */
  const [editingDraftDates, setEditingDraftDates] = useState<
    Record<string, string>
  >({});

  const handleDraftDateChange = useCallback(
    (key: string, date: string | null) => {
      setEditingDraftDates((prev) => {
        if (date === null) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: date };
      });
    },
    []
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("detail");
    params.delete("edit");
    const qs = params.toString();
    setDraftSessions([]);
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
    Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoading(true);
        setSaveError(null);
        setPending({});
        return Promise.all([
          fetch(`/api/bookings/${bookingId}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/bookings/${bookingId}/activity?page=1&pageSize=5`).then(
            (r) => (r.ok ? r.json() : { entries: [], total: 0 })
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

  // Normalize conflicting URL params on mount.
  useEffect(() => {
    const detailId = searchParams.get("detail");
    const editId = searchParams.get("edit");
    if (detailId && editId && detailId !== editId) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("detail");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Per-session conflict fetch ──────────────────────────────────────────────
  //
  // Build an array of "visible session dates" (existing committed + locked drafts)
  // and re-fetch conflicts whenever any date changes. We batch unique dates into
  // as few network requests as possible: one fetch per unique date.
  //
  // Existing sessions can have pending edits — use the edited date if present.
  // Draft sessions use their own date.

  const allVisibleSessionDates: string[] = useMemo(() => {
    if (!booking) return [];
    const dates: string[] = [];
    for (let i = 0; i < booking.sessions.length; i++) {
      // If this session is currently being edited, use the in-flight draft date
      // so conflicts fire while the user is still typing (before ✓ is clicked).
      const inFlightDate = editingDraftDates[String(i)];
      if (inFlightDate) {
        dates.push(inFlightDate);
      } else {
        const edit = pendingSessionEdits[i];
        const s = edit ? edit.startAt : new Date(booking.sessions[i].startAt);
        dates.push(isoDate(s));
      }
    }
    for (let di = 0; di < draftSessions.length; di++) {
      const d = draftSessions[di];
      // For unlocked drafts: use the in-flight typed date if present.
      const inFlightDate = editingDraftDates[`draft:${di}`];
      if (inFlightDate) {
        dates.push(inFlightDate);
      } else if (d.locked) {
        dates.push(isoDate(d.startAt));
      }
    }
    // Deduplicate while preserving order (first occurrence wins).
    const seen = new Set<string>();
    return dates.filter((d) => {
      if (!d || seen.has(d)) return false;
      seen.add(d);
      return true;
    });
  }, [booking, pendingSessionEdits, draftSessions, editingDraftDates]);

  useEffect(() => {
    if (!booking) return;

    const uniqueDates = [...new Set(allVisibleSessionDates.filter(Boolean))];
    if (uniqueDates.length === 0) return;

    // Only fetch dates that are not already cached — treat shiftsByDateRef as
    // the cache. Cached entries are never evicted (harmless small footprint).
    const datesToFetch = uniqueDates.filter((d) => !shiftsByDateRef.current.has(d));
    if (datesToFetch.length === 0) return;

    const myId = ++reqIdRef.current;
    let cancelled = false;

    // Mark only the new in-flight dates as loading.
    setLoadingDates(new Set(datesToFetch));

    Promise.all(
      datesToFetch.map((date) =>
        fetch(
          `/api/bookings/shifts-on-date?${new URLSearchParams({ date, excludeId: bookingId }).toString()}`
        )
          .then((r) => (r.ok ? r.json() : { shifts: [] }))
          .then((data: { shifts: ShiftHit[] }) => [date, data.shifts ?? []] as const)
          .catch(() => [date, [] as ShiftHit[]] as const)
      )
    ).then((entries) => {
      if (cancelled || myId !== reqIdRef.current) return;
      setLoadingDates(new Set());
      // Merge new results into the existing cache rather than overwriting.
      setShiftsByDate((prev) => {
        const next = new Map(prev);
        for (const [date, shifts] of entries) {
          next.set(date, shifts);
        }
        // Keep the ref in sync with the new map.
        shiftsByDateRef.current = next;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
    // allVisibleSessionDates is a new array reference each render but its contents
    // are what matter — JSON.stringify gives a stable dependency.
    // shiftsByDate intentionally omitted: including it would cause a re-run on
    // every cache write, defeating the purpose. The filter inside the effect
    // reads the current snapshot via the functional setState pattern (merge).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allVisibleSessionDates), bookingId]);

  // Whether any session has an unresolved conflict — gates the global Save button.
  // We only count conflicts for dates that are "committed" (pending or saved),
  // not for in-flight dates the user hasn't confirmed yet.
  const hasAnyConflict = useMemo(() => {
    if (!booking) return false;
    for (let i = 0; i < booking.sessions.length; i++) {
      const edit = pendingSessionEdits[i];
      const date = edit ? isoDate(edit.startAt) : isoDate(booking.sessions[i].startAt);
      const shifts = shiftsByDate.get(date) ?? [];
      if (shifts.length > 0) return true;
    }
    for (const d of draftSessions) {
      if (!d.locked) continue;
      const shifts = shiftsByDate.get(isoDate(d.startAt)) ?? [];
      if (shifts.length > 0) return true;
    }
    return false;
  }, [booking, pendingSessionEdits, draftSessions, shiftsByDate]);

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

  const lockedDraftCount = draftSessions.filter((d) => d.locked).length;
  const pendingCount =
    Object.keys(pending).length +
    Object.keys(pendingSessionEdits).length +
    lockedDraftCount;
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
    setPendingSessionEdits({});
    setDraftSessions([]);
    setSaveError(null);
  }

  async function save() {
    if (!hasPending || !booking) return;
    if (hasAnyConflict) {
      setSaveError(t("conflictBlocksSave"));
      toast.error(t("conflictBlocksSave"));
      return;
    }
    setSaving(true);
    setSaveError(null);

    const previous = booking;
    const previousActivity = activity;
    const previousTotal = activityTotal;
    const previousDrafts = draftSessions;
    const previousSessionEdits = pendingSessionEdits;
    const optimistic = applyChanges(booking, pending);

    // Build the final sessions array: overlay pendingSessionEdits onto existing,
    // then append locked draft sessions.
    const mergedSessions: SessionDoc[] = optimistic.sessions.map((s, i) => {
      const edit = pendingSessionEdits[i];
      return edit
        ? { startAt: edit.startAt.toISOString(), endAt: edit.endAt.toISOString() }
        : s;
    });
    const lockedDrafts = draftSessions.filter((d) => d.locked);
    for (const d of lockedDrafts) {
      mergedSessions.push({ startAt: d.startAt, endAt: d.endAt });
    }

    setBooking({ ...optimistic, sessions: mergedSessions });

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, value] of Object.entries(pending)) {
      const before = getCurrentValue(previous, key as EditableKey);
      changes[key] = { before, after: value };
    }
    if (
      Object.keys(pendingSessionEdits).length > 0 ||
      lockedDrafts.length > 0
    ) {
      changes["sessions"] = { before: previous.sessions, after: mergedSessions };
    }
    prependOptimisticActivity(
      "status" in pending ? "status_changed" : "updated",
      changes
    );

    try {
      const body: Record<string, unknown> = { ...pending };
      if (
        Object.keys(pendingSessionEdits).length > 0 ||
        lockedDrafts.length > 0
      ) {
        body["sessions"] = mergedSessions;
      }
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      const updated: BookingDoc = await res.json();
      setBooking(updated);
      setPending({});
      setPendingSessionEdits({});
      setDraftSessions([]);
      toast.success(t("savedToast"));
      startTransition(() => router.refresh());
      await refetchInlineActivity();
    } catch (err) {
      setBooking(previous);
      setActivity(previousActivity);
      setActivityTotal(previousTotal);
      setDraftSessions(previousDrafts);
      setPendingSessionEdits(previousSessionEdits);
      const msg = err instanceof Error ? err.message : "Couldn't save";
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Patches the booking with a new full sessions array (used ONLY by
   * remove-session and the multi-day confirm dialog — NOT by inline edits,
   * which now go into pendingSessionEdits).
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
   * Called when a SessionCard confirms an edit.
   * For single-day sessions: push into pendingSessionEdits (no immediate API).
   * For multi-day + time-only edits: open the confirm dialog first.
   * For multi-day + date edits: apply shiftSession, then push all resulting
   * sessions into pendingSessionEdits.
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
      // Single-day: queue into pending edits.
      setPendingSessionEdits((prev) => ({
        ...prev,
        [sessionIdx]: { startAt: newSession.startAt, endAt: newSession.endAt },
      }));
      return;
    }

    if (kind === "time") {
      // Multi-day, time-only edit: ask the user which scope to apply.
      setPendingSessionEditDialog({ sessionIdx, originalSession, newSession, kind });
      setSessionDialogOpen(true);
      return;
    }

    // Multi-day, date changed: apply shiftSession.
    const today = new Date();
    const shiftMs =
      newSession.startAt.getTime() - originalSession.startAt.getTime();
    const result = shiftSession(originalSession, shiftMs, today);
    if (result.length > 1) {
      toast.warning(tDnd("pastSplitWarning"));
    }
    // Flatten result back into pending: remove original index, insert all results.
    const updated = booking.sessions.flatMap((s, i) =>
      i === sessionIdx ? result.map(sessionToDoc) : [s]
    );
    void patchSessions(updated);
  }

  /**
   * Discards a pending edit for an existing session (user clicks ✗ while the
   * session card has an unsaved edit indicator).
   */
  function handleDiscardSessionEdit(sessionIdx: number) {
    setPendingSessionEdits((prev) => {
      const next = { ...prev };
      delete next[sessionIdx];
      return next;
    });
  }

  function handleSessionApplyToDay() {
    if (!pendingSessionEditDialog || !booking) return;
    const { sessionIdx, originalSession, newSession } = pendingSessionEditDialog;
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const sessionStart = new Date(
      originalSession.startAt.getFullYear(),
      originalSession.startAt.getMonth(),
      originalSession.startAt.getDate()
    );
    if (sessionStart < todayStart) {
      toast.error(tDnd("thisDayOnlyOnPast"));
      setSessionDialogOpen(false);
      setPendingSessionEditDialog(null);
      return;
    }

    const touchedDay = originalSession.startAt;
    const result = splitDayOut(
      originalSession,
      touchedDay,
      newSession.startAt,
      newSession.endAt
    );
    const updated = booking.sessions.flatMap((s, i) =>
      i === sessionIdx ? result.map(sessionToDoc) : [s]
    );
    setSessionDialogOpen(false);
    setPendingSessionEditDialog(null);
    void patchSessions(updated);
  }

  function handleSessionApplyToSession() {
    if (!pendingSessionEditDialog || !booking) return;
    const { sessionIdx, originalSession, newSession, kind } =
      pendingSessionEditDialog;
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
    setPendingSessionEditDialog(null);
    void patchSessions(updated);
  }

  function handleSessionDialogCancel() {
    setSessionDialogOpen(false);
    setPendingSessionEditDialog(null);
  }

  function handleAddSession() {
    if (!booking) return;
    const allSessions: SessionDoc[] = [
      ...booking.sessions,
      ...draftSessions.map((d) => ({ startAt: d.startAt, endAt: d.endAt })),
    ];
    const last = allSessions[allSessions.length - 1];
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
      const endOfNextDay = new Date(nextDay);
      endOfNextDay.setHours(
        new Date(last.endAt).getHours(),
        new Date(last.endAt).getMinutes(),
        0,
        0
      );
      newEnd = endOfNextDay;
    } else {
      const today = new Date();
      today.setHours(10, 0, 0, 0);
      newStart = today;
      const endDefault = new Date(today);
      endDefault.setHours(17, 0, 0, 0);
      newEnd = endDefault;
    }

    const draft: DraftSession = {
      draftId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
      locked: false,
    };
    setDraftSessions((prev) => [...prev, draft]);
  }

  function handleDiscardDraft(draftId: string) {
    setDraftSessions((prev) => prev.filter((d) => d.draftId !== draftId));
  }

  function handleUpdateDraft(
    draftId: string,
    startAt: string,
    endAt: string
  ) {
    setDraftSessions((prev) =>
      prev.map((d) =>
        d.draftId === draftId ? { ...d, startAt, endAt } : d
      )
    );
  }

  /** Locks a draft in place — transforms from editor to display mode. */
  function handleLockDraft(draftId: string) {
    setDraftSessions((prev) =>
      prev.map((d) =>
        d.draftId === draftId ? { ...d, locked: true } : d
      )
    );
  }

  /** Unlocks a draft — re-opens its inline editor. */
  function handleUnlockDraft(draftId: string) {
    setDraftSessions((prev) =>
      prev.map((d) =>
        d.draftId === draftId ? { ...d, locked: false } : d
      )
    );
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
      setConfirmDiscardOpen(true);
      return;
    }
    close();
  }

  function confirmDiscard() {
    setConfirmDiscardOpen(false);
    discardAll();
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

  const confirmDialogProps = useMemo(() => {
    if (!pendingSessionEditDialog)
      return { sessionDayCount: 1, pastDayCount: 0 };
    const days = countDays(pendingSessionEditDialog.originalSession);
    const pastDays = countPastDays(
      pendingSessionEditDialog.originalSession,
      new Date()
    );
    return { sessionDayCount: days, pastDayCount: pastDays };
  }, [pendingSessionEditDialog]);

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
              draftSessions={draftSessions}
              pendingSessionEdits={pendingSessionEdits}
              editingDraftDates={editingDraftDates}
              locale={locale}
              onCommit={commitField}
              onDiscard={discardField}
              onViewAllHistory={() => setHistoryDialogOpen(true)}
              disabled={saving}
              shiftsByDate={shiftsByDate}
              loadingDates={loadingDates}
              onSessionCommit={handleSessionCommit}
              onDiscardSessionEdit={handleDiscardSessionEdit}
              onAddSession={handleAddSession}
              onRemoveSession={handleRemoveSession}
              onDiscardDraft={handleDiscardDraft}
              onUpdateDraft={handleUpdateDraft}
              onLockDraft={handleLockDraft}
              onUnlockDraft={handleUnlockDraft}
              onDraftDateChange={handleDraftDateChange}
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
            saveBlocked={hasAnyConflict}
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

      {/* Discard-changes confirmation — replaces window.confirm */}
      <DiscardChangesDialog
        open={confirmDiscardOpen}
        pendingCount={pendingCount}
        onKeepEditing={() => setConfirmDiscardOpen(false)}
        onDiscard={confirmDiscard}
      />
    </Dialog>
  );
}

// ─── DiscardChangesDialog ─────────────────────────────────────────────────────

function DiscardChangesDialog({
  open,
  pendingCount,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  pendingCount: number;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("app.bookings.detail");
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onKeepEditing()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("discardTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("discardDescription", { count: pendingCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepEditing}>
            {t("keepEditing")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>
            {t("discardConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
  draftSessions,
  pendingSessionEdits,
  editingDraftDates,
  locale,
  onCommit,
  onDiscard,
  onViewAllHistory,
  disabled,
  shiftsByDate,
  loadingDates,
  onSessionCommit,
  onDiscardSessionEdit,
  onAddSession,
  onRemoveSession,
  onDiscardDraft,
  onUpdateDraft,
  onLockDraft,
  onUnlockDraft,
  onDraftDateChange,
}: {
  booking: BookingDoc;
  activity: ActivityEntry[];
  activityTotal: number;
  pending: PendingChanges;
  draftSessions: DraftSession[];
  pendingSessionEdits: Record<number, PendingSessionEdit>;
  editingDraftDates: Record<string, string>;
  locale: string;
  onCommit: (key: EditableKey, value: string | number | null) => void;
  onDiscard: (key: EditableKey) => void;
  onViewAllHistory: () => void;
  disabled: boolean;
  shiftsByDate: Map<string, ShiftHit[]>;
  loadingDates: Set<string>;
  onSessionCommit: (
    idx: number,
    newSession: Session,
    kind: "time" | "date" | "both"
  ) => void;
  onDiscardSessionEdit: (idx: number) => void;
  onAddSession: () => void;
  onRemoveSession: (idx: number) => void;
  onDiscardDraft: (draftId: string) => void;
  onUpdateDraft: (draftId: string, startAt: string, endAt: string) => void;
  onLockDraft: (draftId: string) => void;
  onUnlockDraft: (draftId: string) => void;
  onDraftDateChange: (key: string, date: string | null) => void;
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

  const [showPast, setShowPast] = useState(false);

  const allSessions = booking?.sessions ?? [];
  const { upcomingSessions, pastSessions } = useMemo(() => {
    const upcoming: SessionDoc[] = [];
    const past: SessionDoc[] = [];
    for (const s of allSessions) {
      if (isPastSession(s)) {
        past.push(s);
      } else {
        upcoming.push(s);
      }
    }
    const byStartAt = (a: SessionDoc, b: SessionDoc) =>
      new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    upcoming.sort(byStartAt);
    past.sort(byStartAt);
    return { upcomingSessions: upcoming, pastSessions: past };
  }, [allSessions]);

  const hasPastSessions = pastSessions.length > 0;
  const visibleSessions = showPast
    ? [...upcomingSessions, ...pastSessions]
    : upcomingSessions;

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

        {/* Sessions list — inline-editable cards */}

        {/* Show past toggle — only visible when there are past sessions */}
        {hasPastSessions ? (
          <div className="mb-2 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPast((v) => !v)}
              className={cn(
                showPast && "bg-brand text-brand-foreground border-brand hover:bg-brand/90"
              )}
            >
              {showPast ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              {showPast ? tSessions("hidePast") : tSessions("showPast")}
            </Button>
            {!showPast ? (
              <span className="text-xs text-muted-foreground">
                {tSessions("pastHidden", { count: pastSessions.length })}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          {visibleSessions.map((s, idx) => {
            const originalIdx = (booking?.sessions ?? []).findIndex(
              (orig) =>
                orig.startAt === s.startAt && orig.endAt === s.endAt
            );
            const resolvedIdx = originalIdx >= 0 ? originalIdx : idx;
            const hasPendingEdit = resolvedIdx in pendingSessionEdits;
            // The effective date for this card — in-flight draft date takes priority.
            const inFlightDate = editingDraftDates[String(resolvedIdx)];
            const committedDate = hasPendingEdit
              ? isoDate(pendingSessionEdits[resolvedIdx].startAt)
              : isoDate(s.startAt);
            // For conflict display: while editing use in-flight date; otherwise use committed.
            const effectiveDateForConflict = inFlightDate ?? committedDate;
            const sessionConflicts = shiftsByDate.get(effectiveDateForConflict) ?? [];
            const isLoadingConflict = loadingDates.has(effectiveDateForConflict);
            return (
              <SessionCard
                key={`${s.startAt}-${s.endAt}`}
                session={s}
                sessionIndex={resolvedIdx}
                total={(booking?.sessions ?? []).length}
                locale={locale}
                disabled={disabled}
                isPast={isPastSession(s)}
                label={tSessions("label", { n: resolvedIdx + 1 })}
                removeLabel={tSessions("remove")}
                unsavedLabel={tSessions("unsaved")}
                hasPendingEdit={hasPendingEdit}
                pendingEdit={pendingSessionEdits[resolvedIdx]}
                conflicts={sessionConflicts}
                isCheckingConflicts={isLoadingConflict}
                onCommit={(newSession, kind) =>
                  onSessionCommit(resolvedIdx, newSession, kind)
                }
                onRemove={() => onRemoveSession(resolvedIdx)}
                onDiscardEdit={() => onDiscardSessionEdit(resolvedIdx)}
                onDraftDateChange={(date) =>
                  onDraftDateChange(String(resolvedIdx), date)
                }
              />
            );
          })}
          {draftSessions.map((draft, draftIdx) => {
            // The effective date for this draft card — in-flight date takes priority.
            const inFlightDate = editingDraftDates[`draft:${draftIdx}`];
            const effectiveDateForConflict = inFlightDate ?? isoDate(draft.startAt);
            const isLoadingConflict = loadingDates.has(effectiveDateForConflict);
            const draftConflicts = shiftsByDate.get(effectiveDateForConflict) ?? [];
            return draft.locked ? (
              <LockedDraftCard
                key={draft.draftId}
                draft={draft}
                locale={locale}
                disabled={disabled}
                label={tSessions("label", {
                  n: booking.sessions.length + draftIdx + 1,
                })}
                unsavedLabel={tSessions("unsaved")}
                removeLabel={tSessions("remove")}
                conflicts={draftConflicts}
                loadingConflict={isLoadingConflict}
                onEdit={() => onUnlockDraft(draft.draftId)}
                onRemove={() => onDiscardDraft(draft.draftId)}
              />
            ) : (
              <DraftSessionCard
                key={draft.draftId}
                draft={draft}
                draftIndex={draftIdx}
                locale={locale}
                disabled={disabled}
                label={tSessions("label", {
                  n: booking.sessions.length + draftIdx + 1,
                })}
                conflicts={draftConflicts}
                isCheckingConflicts={isLoadingConflict}
                onDiscard={() => onDiscardDraft(draft.draftId)}
                onUpdate={(startAt, endAt) =>
                  onUpdateDraft(draft.draftId, startAt, endAt)
                }
                onLock={() => onLockDraft(draft.draftId)}
                onDraftDateChange={(date) =>
                  onDraftDateChange(`draft:${draftIdx}`, date)
                }
              />
            );
          })}
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

// ─── SessionConflictAlert ─────────────────────────────────────────────────────

function SessionConflictAlert({
  date,
  locale,
  conflicts,
  loading,
}: {
  date: string;
  locale: string;
  conflicts: ShiftHit[];
  loading: boolean;
}) {
  const tFields = useTranslations("app.bookings.detail.fields");
  if (loading) {
    return (
      <div
        className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"
        aria-live="polite"
      >
        <Loader2Icon className="size-3.5 animate-spin" />
        <span>Checking for conflicts…</span>
      </div>
    );
  }
  if (conflicts.length === 0) return null;
  const displayDate = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : date;
  return (
    <div className="mt-2 flex items-start gap-2 border border-destructive bg-destructive/10 px-3 py-2 text-xs">
      <AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-destructive">
          {tFields("conflictsLabel", { date: displayDate })}
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
  );
}

// ─── SessionCard ─────────────────────────────────────────────────────────────

/**
 * Inline-editable card for a single EXISTING session.
 *
 * ✓ no longer fires an immediate API call — it queues the edit into
 * `pendingSessionEdits` via `onCommit`. The parent renders the "Unsaved" pill
 * and a ✗ to drop the pending edit without saving.
 */
function SessionCard({
  session,
  sessionIndex,
  total,
  locale,
  disabled,
  isPast,
  label,
  removeLabel,
  unsavedLabel,
  hasPendingEdit,
  pendingEdit,
  conflicts,
  isCheckingConflicts,
  onCommit,
  onRemove,
  onDiscardEdit,
  onDraftDateChange,
}: {
  session: SessionDoc;
  sessionIndex: number;
  total: number;
  locale: string;
  disabled: boolean;
  isPast: boolean;
  label: string;
  removeLabel: string;
  unsavedLabel: string;
  hasPendingEdit: boolean;
  pendingEdit: PendingSessionEdit | undefined;
  conflicts: ShiftHit[];
  isCheckingConflicts: boolean;
  onCommit: (newSession: Session, kind: "time" | "date" | "both") => void;
  onRemove: () => void;
  onDiscardEdit: () => void;
  onDraftDateChange: (date: string | null) => void;
}) {
  const tFields = useTranslations("app.bookings.detail.fields");
  const tSessions = useTranslations("app.bookings.sessions");

  // Display values — prefer pendingEdit (the optimistic draft) over the committed session.
  const displayStart = pendingEdit
    ? pendingEdit.startAt.toISOString()
    : session.startAt;
  const displayEnd = pendingEdit
    ? pendingEdit.endAt.toISOString()
    : session.endAt;

  const startDate = isoDate(session.startAt);
  const startTime = hhmm(session.startAt);
  const endTime = hhmm(session.endAt);

  const [editing, setEditing] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [draftStartTime, setDraftStartTime] = useState(startTime);
  const [draftEndTime, setDraftEndTime] = useState(endTime);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync when the parent updates (e.g. after a PATCH settles).
  useEffect(() => {
    if (editing) return;
    const startAt = session.startAt;
    const endAt = session.endAt;
    Promise.resolve().then(() => {
      setDraftStartDate(isoDate(startAt));
      setDraftStartTime(hhmm(startAt));
      setDraftEndTime(hhmm(endAt));
      setError(null);
    });
  }, [session.startAt, session.endAt, editing]);

  // Suppress unused-variable lint — sessionIndex is passed to the parent via
  // the onDraftDateChange closure (the caller already binds the key).
  void sessionIndex;

  function startEdit() {
    if (disabled) return;
    const initialDate = isoDate(session.startAt);
    setDraftStartDate(initialDate);
    setDraftStartTime(hhmm(session.startAt));
    setDraftEndTime(hhmm(session.endAt));
    setError(null);
    setEditing(true);
    // Emit the initial in-flight date so the parent starts fetching immediately.
    onDraftDateChange(initialDate || null);
    setTimeout(() => firstInputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setError(null);
    setEditing(false);
    // Clear the in-flight date from the parent.
    onDraftDateChange(null);
  }

  function commit() {
    const newStartAt = combineDatetime(draftStartDate, draftStartTime);
    const newEndAt = combineDatetime(draftStartDate, draftEndTime);
    if (!newStartAt || !newEndAt) {
      setError("Invalid date or time.");
      return;
    }
    if (draftEndTime <= draftStartTime) {
      setError(tFields("endBeforeStart"));
      return;
    }
    const start = new Date(newStartAt);
    const end = new Date(newEndAt);
    setError(null);
    setEditing(false);
    // Clear the in-flight date — it's now committed.
    onDraftDateChange(null);

    const dateChanged = draftStartDate !== startDate;
    const timeChanged =
      draftStartTime !== startTime || draftEndTime !== endTime;
    let kind: "time" | "date" | "both";
    if (dateChanged && timeChanged) kind = "both";
    else if (dateChanged) kind = "date";
    else kind = "time";

    onCommit({ startAt: start, endAt: end }, kind);
  }

  const isOnlySession = total <= 1;
  const isDirty =
    draftStartDate !== startDate ||
    draftStartTime !== startTime ||
    draftEndTime !== endTime;
  const isSessionValid =
    !!draftStartDate &&
    !!draftStartTime &&
    !!draftEndTime &&
    draftEndTime > draftStartTime;
  const canCommit = isDirty && isSessionValid;

  // While editing, show the in-flight draft date for conflict lookup; otherwise
  // use the display date (which already incorporates a pending edit if any).
  const conflictDate = editing ? draftStartDate : isoDate(displayStart);

  return (
    <div
      className={cn(
        "border bg-card text-card-foreground p-3",
        hasPendingEdit ? "border-brand" : "border-border",
        isPast && !editing && "opacity-60"
      )}
    >
      {/* Card header: label + edit/delete controls */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
              isPast && !editing && "line-through"
            )}
          >
            {label}
          </span>
          {isPast && !editing ? (
            <span className="inline-flex items-center border border-muted-foreground/40 bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {tSessions("past")}
            </span>
          ) : null}
          {hasPendingEdit && !editing ? (
            <span className="inline-flex items-center border border-brand bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              {unsavedLabel}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={commit}
                aria-label="Confirm"
                disabled={disabled || !canCommit || isCheckingConflicts}
              >
                {isCheckingConflicts ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  <CheckIcon className="size-4" />
                )}
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
            <>
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
              {hasPendingEdit ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={onDiscardEdit}
                  disabled={disabled}
                  aria-label="Discard edit"
                  className="text-muted-foreground hover:text-destructive focus-visible:text-destructive"
                >
                  <XIcon className="size-4" />
                </Button>
              ) : null}
            </>
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
        <>
          <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tFields("startAt")}
              </span>
              <span
                className={cn(
                  "text-sm text-foreground",
                  isPast && "line-through"
                )}
              >
                {displayStart
                  ? new Date(displayStart).toLocaleString(locale, {
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
              <span
                className={cn(
                  "text-sm text-foreground",
                  isPast && "line-through"
                )}
              >
                {displayEnd
                  ? new Date(displayEnd).toLocaleString(locale, {
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
          <SessionConflictAlert
            date={conflictDate}
            locale={locale}
            conflicts={conflicts}
            loading={isCheckingConflicts}
          />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : null}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {tFields("date")}
            </span>
            <Input
              ref={firstInputRef}
              type="date"
              value={draftStartDate}
              onChange={(e) => {
                const val = e.target.value;
                setDraftStartDate(val);
                // Emit in-flight date so parent re-fetches conflicts immediately.
                onDraftDateChange(val || null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancelEdit();
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tFields("startTime")}
              </span>
              <Input
                type="time"
                value={draftStartTime}
                onChange={(e) => setDraftStartTime(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") cancelEdit();
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tFields("endTime")}
              </span>
              <Input
                type="time"
                value={draftEndTime}
                onChange={(e) => setDraftEndTime(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") cancelEdit();
                }}
              />
            </div>
          </div>
          {/* Show conflict alert in edit mode too — using current draft date. */}
          <SessionConflictAlert
            date={conflictDate}
            locale={locale}
            conflicts={conflicts}
            loading={isCheckingConflicts}
          />
        </div>
      )}
    </div>
  );
}

// ─── LockedDraftCard ─────────────────────────────────────────────────────────

/**
 * A locked draft session — visually identical to a SessionCard in display mode,
 * with an "Unsaved" pill. Edit (✏️) re-opens the DraftSessionCard editor;
 * Remove (✗) discards the draft entirely.
 */
function LockedDraftCard({
  draft,
  locale,
  disabled,
  label,
  unsavedLabel,
  removeLabel,
  conflicts,
  loadingConflict,
  onEdit,
  onRemove,
}: {
  draft: DraftSession;
  locale: string;
  disabled: boolean;
  label: string;
  unsavedLabel: string;
  removeLabel: string;
  conflicts: ShiftHit[];
  loadingConflict: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const tFields = useTranslations("app.bookings.detail.fields");
  const sessionDate = isoDate(draft.startAt);
  return (
    <div className="border border-brand bg-card text-card-foreground p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="inline-flex items-center border border-brand bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
            {unsavedLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onEdit}
            disabled={disabled}
            aria-label={`Edit ${label}`}
          >
            <PencilIcon className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onRemove}
            disabled={disabled}
            aria-label={removeLabel}
            className="text-muted-foreground hover:text-destructive focus-visible:text-destructive"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tFields("startAt")}
          </span>
          <span className="text-sm text-foreground">
            {draft.startAt
              ? new Date(draft.startAt).toLocaleString(locale, {
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
            {draft.endAt
              ? new Date(draft.endAt).toLocaleString(locale, {
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
      <SessionConflictAlert
        date={sessionDate}
        locale={locale}
        conflicts={conflicts}
        loading={loadingConflict}
      />
    </div>
  );
}

// ─── DraftSessionCard ────────────────────────────────────────────────────────

/**
 * A session row that was appended locally via "Add session" but has not yet
 * been confirmed. Times are editable inline; clicking ✓ LOCKS the draft
 * (transforms it to a LockedDraftCard) rather than calling the API; clicking ✗
 * discards the draft entirely.
 */
function DraftSessionCard({
  draft,
  draftIndex,
  locale,
  disabled,
  label,
  conflicts,
  isCheckingConflicts,
  onDiscard,
  onUpdate,
  onLock,
  onDraftDateChange,
}: {
  draft: DraftSession;
  draftIndex: number;
  locale: string;
  disabled: boolean;
  label: string;
  conflicts: ShiftHit[];
  isCheckingConflicts: boolean;
  onDiscard: () => void;
  onUpdate: (startAt: string, endAt: string) => void;
  onLock: () => void;
  onDraftDateChange: (date: string | null) => void;
}) {
  const tFields = useTranslations("app.bookings.detail.fields");

  // Suppress unused-variable lint — draftIndex is bound by the caller's closure.
  void draftIndex;
  // locale is used for the conflict alert.
  void locale;

  const [draftStartDate, setDraftStartDate] = useState(isoDate(draft.startAt));
  const [draftStartTime, setDraftStartTime] = useState(hhmm(draft.startAt));
  const [draftEndTime, setDraftEndTime] = useState(hhmm(draft.endAt));
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Emit the initial date so conflicts are fetched right when the card mounts.
  useEffect(() => {
    const initialDate = isoDate(draft.startAt);
    if (initialDate) {
      onDraftDateChange(initialDate);
    }
    setTimeout(() => firstInputRef.current?.focus(), 0);
    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up the in-flight date entry when this draft card unmounts (discarded).
  useEffect(() => {
    return () => {
      onDraftDateChange(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDraftValid =
    !!draftStartDate &&
    !!draftStartTime &&
    !!draftEndTime &&
    draftEndTime > draftStartTime;

  function commit() {
    const newStartAt = combineDatetime(draftStartDate, draftStartTime);
    const newEndAt = combineDatetime(draftStartDate, draftEndTime);
    if (!newStartAt || !newEndAt) {
      setError("Invalid date or time.");
      return;
    }
    if (draftEndTime <= draftStartTime) {
      setError(tFields("endBeforeStart"));
      return;
    }
    setError(null);
    // Clear in-flight date — it's now committed into the parent's locked state.
    onDraftDateChange(null);
    // First persist the current times into parent state, then lock.
    onUpdate(newStartAt, newEndAt);
    onLock();
  }

  return (
    <div className="border border-dashed border-brand bg-muted/30 p-3">
      {/* Card header: label + check/discard controls */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="inline-flex items-center border border-brand/50 bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
            draft
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={commit}
            aria-label="Confirm draft session"
            disabled={disabled || !isDraftValid || isCheckingConflicts}
          >
            {isCheckingConflicts ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onDiscard}
            aria-label="Remove draft session"
            className="text-muted-foreground hover:text-destructive focus-visible:text-destructive"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Inline edit — always open for draft rows */}
      <div className="flex flex-col gap-3">
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tFields("date")}
          </span>
          <Input
            ref={firstInputRef}
            type="date"
            value={draftStartDate}
            onChange={(e) => {
              const val = e.target.value;
              setDraftStartDate(val);
              setError(null);
              // Emit in-flight date so parent re-fetches conflicts immediately.
              onDraftDateChange(val || null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") onDiscard();
            }}
            disabled={disabled}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {tFields("startTime")}
            </span>
            <Input
              type="time"
              value={draftStartTime}
              onChange={(e) => {
                setDraftStartTime(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") onDiscard();
              }}
              disabled={disabled}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {tFields("endTime")}
            </span>
            <Input
              type="time"
              value={draftEndTime}
              onChange={(e) => {
                setDraftEndTime(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") onDiscard();
              }}
              disabled={disabled}
            />
          </div>
        </div>
        {/* Conflict alert shown inline while editing the draft. */}
        <SessionConflictAlert
          date={draftStartDate}
          locale={locale}
          conflicts={conflicts}
          loading={isCheckingConflicts}
        />
      </div>
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

function isPastSession(s: { endAt: Date | string }): boolean {
  const end = typeof s.endAt === "string" ? new Date(s.endAt) : s.endAt;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return end < todayStart;
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
