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
import { useActionError } from "@/lib/i18n/actionError";
import { toast } from "sonner";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  HistoryIcon,
  Loader2Icon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleDrawer } from "@/components/ui/collapsible-drawer";
import dynamic from "next/dynamic";
import { LocationPicker, LocationDisplay } from "@/components/ui/location-picker";
import { AlertTriangleIcon } from "lucide-react";
import { STATUS_COLOR_VAR } from "@/lib/bookings/status-style";
import type { BookingTeamOption } from "../_data/team-options";
import { EditableField, type FieldHandle } from "./editable-field";
import { CancelConfirmDialog } from "./cancel-confirm-dialog";
import { BookingHistoryDialog } from "./booking-history-dialog";
import { SessionEditConfirmDialog } from "./session-edit-confirm-dialog";
import { ClientDetailModal } from "@/app/[locale]/(app)/clients/_components/client-detail-modal";
import type { ClientRow } from "@/app/[locale]/(app)/clients/_components/clients-table";
import { getClientByIdAction } from "@/lib/actions/clients";
import { ActivityTimeline } from "./activity-timeline";
import type { ActivityEntry } from "./activity-types";
import type { ShiftHit } from "./booking-wizard-steps/types";
import {
  BOOKING_STATUSES,
  EVENT_TYPES,
  type BookingStatus,
  type EditableKey,
} from "@/lib/validators/booking";
import { SUPPORTED_CURRENCIES } from "@/lib/validators/workspace";
import { formatMoney } from "@/lib/utils/format-currency";
import { TIME_INPUT_LANG, type TimeMode } from "@/lib/utils/time-format";
import { useTimeFormat } from "@/lib/time-format/context";
import {
  countDays,
  countPastDays,
  shiftSession,
  shiftSessionTimes,
  splitDayOut,
  type Session,
} from "@/lib/bookings/session-edits";
import { remainingBalance } from "@/lib/bookings/payment-rules";
import { cn } from "@/lib/utils";

const LocationMap = dynamic(() => import("@/components/ui/location-map"), {
  ssr: false,
  loading: () => <div className="h-40 w-full animate-pulse bg-muted" aria-hidden />,
});

function formatSessionStamp(value: string | Date, locale: string, mode: TimeMode) {
  return new Date(value).toLocaleString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: mode === "12h",
  });
}

type SessionDoc = { startAt: string; endAt: string };

type BookingDoc = {
  _id: string;
  title: string;
  clientName: string;
  clientId: string;
  client: { id: string; name: string; email: string | null; phone: string | null } | null;
  eventType: string;
  status: string;
  teamId: string | null;
  sessions: SessionDoc[];
  firstSessionStart: string;
  lastSessionEnd: string;
  location: { address: string; lat: number | null; lng: number | null };
  amount: { total: number; deposit: number; currency: string };
  payments: { price: number; status: "unpaid" | "paid"; createdAt: string; paidAt: string | null; title: string }[];
  notes: string;
};

type Props = {
  bookingId: string;
  locale: string;
  teams?: BookingTeamOption[];
  writableTeams?: BookingTeamOption[];
  readOnly?: boolean;
  /** Whether the workspace's business address + contact email are both set —
   *  gates the pre-download completeness warning. Defaults to true (no
   *  warning) when the caller doesn't pass it. */
  businessComplete?: boolean;
  /** Used to namespace the "don't show this again" localStorage flag. */
  workspaceId?: string;
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

/** A payment row added locally but not yet persisted to the API. */
type DraftPayment = {
  /** Stable key for React rendering — not sent to the API. */
  draftId: string;
  price: number;
  status: "unpaid" | "paid";
  title: string;
};

/** Pending edit for an existing payment (keyed by payment index in booking.payments). */
type PendingPaymentEdit = { price: number; status: "unpaid" | "paid"; title: string };

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

export function BookingDetailModal({
  bookingId,
  locale,
  teams = [],
  writableTeams = [],
  readOnly = false,
  businessComplete = true,
  workspaceId = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.detail");
  const tDnd = useTranslations("app.bookings.dnd");
  const tEvent = useTranslations("app.bookings.eventTypes");
  const errMsg = useActionError();
  const [, startTransition] = useTransition();

  const eventTypeOptions = useMemo(
    () => EVENT_TYPES.map((e) => ({ value: e, label: safeT(tEvent, e, e) })),
    [tEvent]
  );

  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDoc | null>(null);
  const [viewClient, setViewClient] = useState<ClientRow | null>(null);
  const [viewClientOpen, setViewClientOpen] = useState(false);
  const [viewClientLoading, setViewClientLoading] = useState(false);
  /**
   * Staged client for an in-progress reassignment. Holds the picked client's
   * full contact info so the contact block shows fresh email/phone between
   * "stage" and "save" — the pending `clientId`/`clientName` changes alone
   * would leave the old `booking.client` object in place (H2 fix). Cleared on
   * discardAll and on successful save.
   */
  const [reassignedClient, setReassignedClient] = useState<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingChanges>({});
  const [saving, setSaving] = useState(false);
  /** Session index currently being patched by a direct action (remove, or a
   *  multi-day date/time shift) — scoped separately from `saving` so it
   *  doesn't visually conflict with the unrelated global "Save changes" button. */
  const [sessionActionBusyIdx, setSessionActionBusyIdx] = useState<number | null>(null);
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
  // `draftPayments` is referenced by the BookingTabs call site below (added in
  // the previous step) but was never declared as state, which throws
  // `ReferenceError: draftPayments is not defined` during render — this is why
  // the modal fails to mount and the test can't find the dialog heading.
  /** Draft payments appended by "Add payment" — not yet persisted. */
  const [draftPayments, setDraftPayments] = useState<DraftPayment[]>([]);
  /**
   * Pending edits for EXISTING payments. Keyed by payment index in
   * booking.payments — mirrors `pendingSessionEdits`. Flushed in the global
   * Save together with `pending` scalar changes and draft payments.
   */
  const [pendingPaymentEdits, setPendingPaymentEdits] = useState<
    Record<number, PendingPaymentEdit>
  >({});
  /** Indexes into booking.payments staged for removal on next Save. */
  const [removedPaymentIndexes, setRemovedPaymentIndexes] = useState<Set<number>>(
    new Set()
  );
  function handleToggleRemovePayment(idx: number) {
    setRemovedPaymentIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }
  /**
   * Confirm-discard dialog state — replaces window.confirm for close-with-unsaved.
   */
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  /**
   * Incrementing nonce that forces SessionCard components to remount when
   * bumped. This resets any open inline editor (internal `editing` state) on
   * confirm-discard so uncommitted editors close without losing
   * `pendingSessionEdits` (parent state, re-read on mount).
   */
  const [editorResetNonce, setEditorResetNonce] = useState(0);

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

  async function handleViewClient() {
    if (!booking?.client) return;
    setViewClientLoading(true);
    const res = await getClientByIdAction(booking.client.id);
    setViewClientLoading(false);
    if ("error" in res) {
      toast.error(errMsg(res.error));
      return;
    }
    setViewClient(res);
    setViewClientOpen(true);
  }

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
      .then(async (results) => {
        if (!results || cancelled) return;
        const [b, a] = results;
        setBooking(b);
        const entries: ActivityEntry[] = a?.entries ?? [];
        setActivity(entries);
        setActivityTotal(a?.total ?? 0);
        setLoading(false);

        // Resolve actor display names for the initial page of activity entries.
        const ids = [...new Set(
          entries
            .map((e) => e.actorUserId)
            .filter((id): id is string => !!id)
        )];
        if (ids.length > 0) {
          const params = new URLSearchParams();
          ids.forEach((id) => params.append("ids", id));
          const res = await fetch(`/api/users/names?${params.toString()}`);
          if (!cancelled && res.ok) {
            const names: Record<string, string> = await res.json();
            setActorNames(names);
          }
        }
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
  // Uses the same strict half-open overlap predicate as the wizard: aStart < bEnd && bStart < aEnd.
  const hasAnyConflict = useMemo(() => {
    if (!booking) return false;
    for (let i = 0; i < booking.sessions.length; i++) {
      const edit = pendingSessionEdits[i];
      const effectiveStart = edit ? edit.startAt : new Date(booking.sessions[i].startAt);
      const effectiveEnd = edit ? edit.endAt : new Date(booking.sessions[i].endAt);
      const date = isoDate(effectiveStart);
      const rawShifts = shiftsByDate.get(date) ?? [];
      if (rawShifts.length === 0) continue;
      const aStart = toMinutes(hhmm(effectiveStart));
      const aEnd = toMinutes(hhmm(effectiveEnd));
      if (aStart == null || aEnd == null || aEnd <= aStart) continue;
      const overlapping = rawShifts.filter((s) => {
        // Defense in depth: exclude shifts that belong to the same booking.
        if (s.bookingId === bookingId) return false;
        const bStart = toMinutes(s.shiftStart);
        const bEnd = toMinutes(s.shiftEnd);
        if (bStart == null || bEnd == null) return false;
        return aStart < bEnd && bStart < aEnd;
      });
      if (overlapping.length > 0) return true;
    }
    for (const d of draftSessions) {
      if (!d.locked) continue;
      const rawShifts = shiftsByDate.get(isoDate(d.startAt)) ?? [];
      if (rawShifts.length === 0) continue;
      const aStart = toMinutes(hhmm(d.startAt));
      const aEnd = toMinutes(hhmm(d.endAt));
      if (aStart == null || aEnd == null || aEnd <= aStart) continue;
      const overlapping = rawShifts.filter((s) => {
        if (s.bookingId === bookingId) return false;
        const bStart = toMinutes(s.shiftStart);
        const bEnd = toMinutes(s.shiftEnd);
        if (bStart == null || bEnd == null) return false;
        return aStart < bEnd && bStart < aEnd;
      });
      if (overlapping.length > 0) return true;
    }
    return false;
  }, [booking, pendingSessionEdits, draftSessions, shiftsByDate, bookingId]);

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
    lockedDraftCount +
    draftPayments.length +
    Object.keys(pendingPaymentEdits).length +
    removedPaymentIndexes.size;
  const hasPending = pendingCount > 0;

  // Count open inline editors for EXISTING sessions (keys are numeric strings).
  const openSessionEditorCount = Object.keys(editingDraftDates).filter(
    (k) => !k.startsWith("draft:")
  ).length;
  const unconfirmedDraftCount = draftSessions.filter((d) => !d.locked).length;

  /**
   * Registry of FieldHandle objects for currently-mounted EditableField instances.
   * Keyed by editKey (e.g. "amount.total"). The Map is stable across renders;
   * only its contents change.
   */
  const fieldHandleRegistry = useRef<Map<string, FieldHandle>>(new Map());

  /**
   * Set of editKey strings whose editor is currently open (user is mid-edit).
   * Updated via onFieldEditingChange which is wired to each EditableField's
   * `onEditingChange` prop. Drives `openFieldCount`.
   */
  const [openFieldKeys, setOpenFieldKeys] = useState<Set<string>>(new Set());
  const openFieldCount = openFieldKeys.size;

  const registerFieldHandle = useCallback(
    (editKey: string, handle: FieldHandle | null) => {
      if (handle) {
        fieldHandleRegistry.current.set(editKey, handle);
      } else {
        fieldHandleRegistry.current.delete(editKey);
        // If the field unmounts while open, remove it from open set too.
        setOpenFieldKeys((prev) => {
          if (!prev.has(editKey)) return prev;
          const next = new Set(prev);
          next.delete(editKey);
          return next;
        });
      }
    },
    []
  );

  const onFieldEditingChange = useCallback(
    (editKey: string, isEditing: boolean) => {
      setOpenFieldKeys((prev) => {
        const has = prev.has(editKey);
        if (isEditing === has) return prev; // no change
        const next = new Set(prev);
        if (isEditing) next.add(editKey);
        else next.delete(editKey);
        return next;
      });
    },
    []
  );

  // Total undrafted work: open existing-session editors + unlocked draft editors
  // + open EditableField editors.
  const undraftedCount = openSessionEditorCount + unconfirmedDraftCount + openFieldCount;
  const hasUndrafted = undraftedCount > 0;
  const [unconfirmedDraftsOpen, setUnconfirmedDraftsOpen] = useState(false);

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
    setDraftPayments([]);
    setPendingPaymentEdits({});
    setRemovedPaymentIndexes(new Set());
    setSaveError(null);
    setReassignedClient(null);
  }

  function save() {
    if (!hasPending || !booking) return;
    if (hasUndrafted) {
      setUnconfirmedDraftsOpen(true);
      return;
    }
    void runSave();
  }

  /**
   * "Discard undrafted & save" — cancel every open EditableField editor, drop
   * unlocked drafts, reset open session editors, then proceed with the save
   * using only the already-drafted `pending` map.
   */
  function confirmDiscardUndraftedAndSave() {
    setUnconfirmedDraftsOpen(false);
    // Cancel every open EditableField editor (discard in-progress draft).
    for (const handle of fieldHandleRegistry.current.values()) {
      if (handle.isEditing()) handle.cancel();
    }
    // Drop unlocked drafts and reset open session-editor tracking.
    setDraftSessions((prev) => prev.filter((d) => d.locked));
    setEditingDraftDates({});
    setEditorResetNonce((n) => n + 1);
    void runSave();
  }

  /**
   * "Submit all changes" — commit every valid open EditableField editor into a
   * merged pending map, cancel all open editors, then save everything in one
   * PATCH. If any open editor is invalid, show a toast and leave it open.
   */
  function confirmSubmitAll() {
    if (!booking) return;

    // Gather open dirty handles.
    const openDirty: Array<{ key: string; handle: FieldHandle }> = [];
    for (const [key, handle] of fieldHandleRegistry.current) {
      if (handle.isEditing() && handle.isDirty()) {
        openDirty.push({ key, handle });
      }
    }

    // Block if any open editor has a validation error.
    const hasInvalid = openDirty.some(({ handle }) => !handle.canCommit());
    if (hasInvalid) {
      setUnconfirmedDraftsOpen(false);
      toast.error(t("unconfirmedDrafts.invalidError"));
      return;
    }

    // Build the merged pending synchronously — capture normalized values before
    // calling cancel() (which clears the editor state).
    const merged: PendingChanges = { ...pending };
    for (const { key, handle } of openDirty) {
      const v = handle.getNormalizedValue();
      const current = getCurrentValue(booking, key as EditableKey);
      if (v === current || String(v) === String(current)) {
        delete merged[key];
      } else {
        merged[key] = v;
      }
    }

    // Cancel all open EditableField editors (values already captured above).
    for (const { handle } of openDirty) {
      handle.cancel();
    }

    // Also discard unlocked draft sessions and reset open session editors.
    setDraftSessions((prev) => prev.filter((d) => d.locked));
    setEditingDraftDates({});
    setEditorResetNonce((n) => n + 1);

    // Reflect the merged map in state so UI stays consistent.
    setPending(merged);

    setUnconfirmedDraftsOpen(false);
    void runSave({ pendingOverride: merged });
  }

  async function runSave(opts?: { pendingOverride?: PendingChanges }) {
    const effectivePending = opts?.pendingOverride ?? pending;
    const hasSomethingToSave =
      Object.keys(effectivePending).length > 0 ||
      Object.keys(pendingSessionEdits).length > 0 ||
      draftSessions.some((d) => d.locked) ||
      draftPayments.length > 0 ||
      Object.keys(pendingPaymentEdits).length > 0 ||
      removedPaymentIndexes.size > 0;
    if (!hasSomethingToSave || !booking) return;
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
    const previousDraftPayments = draftPayments;
    const previousPaymentEdits = pendingPaymentEdits;
    const previousRemovedPaymentIndexes = removedPaymentIndexes;
    const optimistic = applyChanges(booking, effectivePending);

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
    for (const [key, value] of Object.entries(effectivePending)) {
      // Raw pin coordinates persist but are never logged server-side — keep the
      // optimistic activity consistent so a coordinate-only save shows nothing.
      if (key === "location.lat" || key === "location.lng") continue;
      const before = getCurrentValue(previous, key as EditableKey);
      changes[key] = { before, after: value };
    }
    if (
      Object.keys(pendingSessionEdits).length > 0 ||
      lockedDrafts.length > 0
    ) {
      changes["sessions"] = { before: previous.sessions, after: mergedSessions };
    }
    if (Object.keys(changes).length > 0) {
      prependOptimisticActivity(
        "status" in effectivePending ? "status_changed" : "updated",
        changes
      );
    }

    try {
      const body: Record<string, unknown> = { ...effectivePending };
      if (
        Object.keys(pendingSessionEdits).length > 0 ||
        lockedDrafts.length > 0
      ) {
        body["sessions"] = mergedSessions;
      }
      if (
        draftPayments.length > 0 ||
        Object.keys(pendingPaymentEdits).length > 0 ||
        removedPaymentIndexes.size > 0
      ) {
        const existing = previous.payments
          .map((p, i) => {
            const edit = pendingPaymentEdits[i];
            return edit ? { price: edit.price, status: edit.status, title: edit.title } : p;
          })
          .filter((_, i) => !removedPaymentIndexes.has(i));
        body["payments"] = [
          ...existing,
          ...draftPayments.map((d) => ({ price: d.price, status: d.status, title: d.title })),
        ];
      }
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(errMsg(data.error, data.params));
      }
      const updated: BookingDoc = await res.json();
      // The PATCH response does not include the `client` block (the GET does).
      // Preserve it from the previous state so email/phone don't collapse.
      // If a clientId reassignment was just saved, use the staged reassigned
      // client's data; otherwise keep the existing client block.
      const clientAfterSave = "clientId" in effectivePending
        ? (reassignedClient
            ? { id: reassignedClient.id, name: reassignedClient.name, email: reassignedClient.email, phone: reassignedClient.phone }
            : null)
        : previous.client;
      setBooking({ ...updated, client: clientAfterSave });
      setPending({});
      setPendingSessionEdits({});
      setDraftSessions([]);
      setDraftPayments([]);
      setPendingPaymentEdits({});
      setRemovedPaymentIndexes(new Set());
      setReassignedClient(null);
      toast.success(t("savedToast"));
      startTransition(() => router.refresh());
      await refetchInlineActivity();
    } catch (err) {
      setBooking(previous);
      setActivity(previousActivity);
      setActivityTotal(previousTotal);
      setDraftSessions(previousDrafts);
      setPendingSessionEdits(previousSessionEdits);
      setDraftPayments(previousDraftPayments);
      setPendingPaymentEdits(previousPaymentEdits);
      setRemovedPaymentIndexes(previousRemovedPaymentIndexes);
      const msg = err instanceof Error ? err.message : errMsg(null);
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
   *
   * `busyIdx` scopes the pending indicator to the session that triggered the
   * patch (remove or a multi-day date/time shift) — it is tracked separately
   * from `saving` so the unrelated global "Save changes" button doesn't flip
   * into its own busy state for an action it didn't initiate.
   */
  async function patchSessions(newSessions: SessionDoc[], busyIdx: number) {
    if (!booking) return;
    setSessionActionBusyIdx(busyIdx);
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
        throw new Error(errMsg(data.error, data.params));
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
      const msg = err instanceof Error ? err.message : errMsg(null);
      toast.error(msg);
    } finally {
      setSessionActionBusyIdx(null);
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
    void patchSessions(updated, sessionIdx);
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
    void patchSessions(updated, sessionIdx);
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
    void patchSessions(updated, sessionIdx);
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

  function handleAddPayment() {
    setDraftPayments((prev) => [
      ...prev,
      { draftId: crypto.randomUUID(), price: 0, status: "unpaid", title: "" },
    ]);
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
    void patchSessions(updated, idx);
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
        className="flex max-h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeaderBar
          booking={booking}
          pending={pending}
          pendingPaymentEdits={pendingPaymentEdits}
          draftPayments={draftPayments}
          removedPaymentIndexes={removedPaymentIndexes}
          loading={loading}
          locale={locale}
          disabled={saving}
          readOnly={readOnly}
          onCommit={commitField}
          onDiscard={discardField}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <ModalSkeleton />
          ) : !booking ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("notFound")}
            </p>
          ) : (
            <BookingTabs
              booking={booking}
              bookingId={bookingId}
              activity={activity}
              activityTotal={activityTotal}
              actorNames={actorNames}
              pending={pending}
              draftSessions={draftSessions}
              pendingSessionEdits={pendingSessionEdits}
              editingDraftDates={editingDraftDates}
              editorResetNonce={editorResetNonce}
              locale={locale}
              reassignedClient={reassignedClient}
              eventTypeOptions={eventTypeOptions}
              teams={teams}
              writableTeams={writableTeams}
              readOnly={readOnly}
              onCommit={commitField}
              onDiscard={discardField}
              onReassign={(c) => {
                setReassignedClient(c);
                commitField("clientId", c.id);
                commitField("clientName", c.name);
              }}
              onClearReassign={() => {
                setReassignedClient(null);
                discardField("clientId");
                discardField("clientName");
              }}
              onViewAllHistory={() => setHistoryDialogOpen(true)}
              onViewClient={handleViewClient}
              viewClientLoading={viewClientLoading}
              disabled={saving}
              busySessionIdx={sessionActionBusyIdx}
              shiftsByDate={shiftsByDate}
              loadingDates={loadingDates}
              onSessionCommit={handleSessionCommit}
              onDiscardSessionEdit={handleDiscardSessionEdit}
              onAddSession={handleAddSession}
              onRemoveSession={handleRemoveSession}
              draftPayments={draftPayments}
              pendingPaymentEdits={pendingPaymentEdits}
              onAddPayment={handleAddPayment}
              onUpdateDraftPayment={(index, price) =>
                setDraftPayments((prev) =>
                  prev.map((d, i) => (i === index ? { ...d, price } : d))
                )
              }
              onUpdateDraftPaymentStatus={(index, status) =>
                setDraftPayments((prev) =>
                  prev.map((d, i) => (i === index ? { ...d, status } : d))
                )
              }
              onUpdateDraftPaymentTitle={(index, title) =>
                setDraftPayments((prev) =>
                  prev.map((d, i) => (i === index ? { ...d, title } : d))
                )
              }
              onRemoveDraftPayment={(draftId) =>
                setDraftPayments((prev) => prev.filter((d) => d.draftId !== draftId))
              }
              onCommitPaymentEdit={(index, edit) => {
                setPendingPaymentEdits((prev) => ({ ...prev, [index]: edit }));
              }}
              removedPaymentIndexes={removedPaymentIndexes}
              onToggleRemovePayment={handleToggleRemovePayment}
              onDiscardDraft={handleDiscardDraft}
              onUpdateDraft={handleUpdateDraft}
              onLockDraft={handleLockDraft}
              onUnlockDraft={handleUnlockDraft}
              onDraftDateChange={handleDraftDateChange}
              registerFieldHandle={registerFieldHandle}
              onFieldEditingChange={onFieldEditingChange}
            />
          )}
        </div>

        {booking && !readOnly ? (
          <DialogFooterBar
            cancelled={booking.status === "cancelled"}
            completed={booking.status === "completed"}
            hasPayments={booking?.payments?.length > 0}
            bookingId={bookingId}
            hasPending={hasPending}
            pendingCount={pendingCount}
            saving={saving}
            saveError={saveError}
            saveBlocked={hasAnyConflict}
            businessComplete={businessComplete}
            workspaceId={workspaceId}
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
        currency={booking?.amount.currency}
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

      {/* Unconfirmed-drafts warning — shown when Save is clicked with undrafted changes */}
      <UnconfirmedDraftsDialog
        open={unconfirmedDraftsOpen}
        count={undraftedCount}
        onCancel={() => setUnconfirmedDraftsOpen(false)}
        onSubmitAll={confirmSubmitAll}
        onDiscardUndrafted={confirmDiscardUndraftedAndSave}
      />

      {/* Stacked client detail modal — read-only reference view, no edit/lifecycle actions */}
      <ClientDetailModal
        client={viewClient}
        open={viewClientOpen}
        onClose={() => setViewClientOpen(false)}
        locale={locale}
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

// ─── UnconfirmedDraftsDialog ──────────────────────────────────────────────────

function UnconfirmedDraftsDialog({
  open,
  count,
  onCancel,
  onSubmitAll,
  onDiscardUndrafted,
}: {
  open: boolean;
  count: number;
  onCancel: () => void;
  onSubmitAll: () => void;
  onDiscardUndrafted: () => void;
}) {
  const t = useTranslations("app.bookings.detail");
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      {/* Wider than the default alert dialog so the three footer actions sit on
          one row at sm+ without overflowing (they stack on mobile). */}
      <AlertDialogContent className="sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("unconfirmedDrafts.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("unconfirmedDrafts.description", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t("unconfirmedDrafts.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onDiscardUndrafted}>
            {t("unconfirmedDrafts.discard")}
          </AlertDialogAction>
          <AlertDialogAction onClick={onSubmitAll} autoFocus>
            {t("unconfirmedDrafts.submitAll")}
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
  pendingPaymentEdits,
  draftPayments,
  removedPaymentIndexes,
  loading,
  locale,
  disabled,
  readOnly,
  onCommit,
  onDiscard,
  onEditAll,
  onClose,
}: {
  booking: BookingDoc | null;
  pending: PendingChanges;
  pendingPaymentEdits: Record<number, PendingPaymentEdit>;
  draftPayments: DraftPayment[];
  removedPaymentIndexes: Set<number>;
  loading: boolean;
  locale: string;
  disabled: boolean;
  readOnly?: boolean;
  onCommit: (key: EditableKey, value: string | number | null) => void;
  onDiscard: (key: EditableKey) => void;
  onEditAll: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("app.bookings.detail.fields");
  const tDetail = useTranslations("app.bookings.detail");
  const tStatus = useTranslations("app.bookings.statusValues");

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  // Status is a read-only pill by default; the dropdown is only mounted after
  // the user clicks the pencil (mirrors the EditableField reveal pattern).
  const [editingStatus, setEditingStatus] = useState(false);

  let outstanding = 0;
  let currency = "PHP";
  if (booking) {
    const total = (pending["amount.total"] as number) ?? booking.amount.total;
    const deposit =
      (pending["amount.deposit"] as number) ?? booking.amount.deposit;
    currency = (pending["amount.currency"] as string) ?? booking.amount.currency;
    const effectivePayments = [
      ...booking.payments
        .map((p, i) => {
          const edit = pendingPaymentEdits[i];
          return edit
            ? { price: edit.price, status: edit.status ?? p.status }
            : { price: p.price, status: p.status };
        })
        .filter((_, i) => !removedPaymentIndexes.has(i)),
      ...draftPayments.map((d) => ({ price: d.price, status: d.status })),
    ];
    const paidOnly = effectivePayments.filter((p) => p.status === "paid");
    outstanding = Math.max(0, remainingBalance(paidOnly, { total, deposit }));
  }
  const isOverdue = booking ? outstanding > 0 : false;

  const effectiveTitle = (pending["title"] as string | undefined) ?? booking?.title ?? "—";
  const effectiveStatus =
    (pending["status"] as string | undefined) ?? booking?.status ?? "";
  const hasTitlePending = "title" in pending;
  const hasStatusPending = "status" in pending;
  const isCancelled = booking?.status === "cancelled";

  const statusOptions = useMemo(
    () =>
      BOOKING_STATUSES.map((s) => ({ value: s, label: safeT(tStatus, s, s) })),
    [tStatus]
  );
  const statusLabel = safeT(tStatus, effectiveStatus, effectiveStatus);
  const statusColor = STATUS_COLOR_VAR[effectiveStatus as BookingStatus];

  function startTitleEdit() {
    if (disabled || isCancelled || !booking || readOnly) return;
    setTitleDraft(effectiveTitle);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }

  function commitTitle() {
    const val = titleDraft.trim();
    if (!val) {
      cancelTitleEdit();
      return;
    }
    onCommit("title", val);
    setEditingTitle(false);
  }

  function cancelTitleEdit() {
    setEditingTitle(false);
    setTitleDraft("");
    if (hasTitlePending) onDiscard("title");
  }

  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {loading ? (
          <Skeleton className="h-5 w-48" />
        ) : (
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <DialogTitle className="min-w-0 flex-1 text-base font-semibold">
              {editingTitle ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitTitle();
                      if (e.key === "Escape") cancelTitleEdit();
                    }}
                    className="h-7 min-w-0 flex-1 text-sm font-semibold"
                    aria-label={t("title")}
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={commitTitle}
                    disabled={disabled || !titleDraft.trim()}
                    aria-label={t("confirmTitle")}
                    className="shrink-0"
                  >
                    <CheckIcon className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={cancelTitleEdit}
                    aria-label={t("cancelTitleEdit")}
                    className="shrink-0"
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              ) : readOnly ? (
                <span className="truncate">{effectiveTitle}</span>
              ) : (
                <button
                  type="button"
                  onClick={startTitleEdit}
                  disabled={disabled || isCancelled}
                  className={cn(
                    "group flex min-w-0 items-center gap-1.5 text-start text-base font-semibold transition-colors",
                    "hover:text-brand focus-visible:text-brand focus-visible:outline-none",
                    "disabled:pointer-events-none disabled:opacity-60",
                    hasTitlePending && "text-brand"
                  )}
                  aria-label={t("editTitle")}
                >
                  <span className="truncate">{effectiveTitle}</span>
                  <PencilIcon className="size-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-90 group-focus-visible:opacity-90" />
                  {hasTitlePending ? (
                    <span className="size-1.5 shrink-0 bg-brand" aria-hidden />
                  ) : null}
                </button>
              )}
            </DialogTitle>

            {/* Status pill — read-only by default; the dropdown is only mounted
                after the pencil is clicked (reveal pattern). Rendered as a
                sibling of the heading so its label never pollutes the heading's
                accessible name. */}
            {booking ? (
              <div className="relative shrink-0">
                {editingStatus && !isCancelled ? (
                  <Select
                    value={effectiveStatus}
                    defaultOpen
                    onValueChange={(v) => {
                      onCommit("status", v);
                      if (hasStatusPending && v === booking.status)
                        onDiscard("status");
                      setEditingStatus(false);
                    }}
                    onOpenChange={(o) => {
                      if (!o) setEditingStatus(false);
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-auto border px-2 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        hasStatusPending
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border bg-background text-muted-foreground hover:border-brand/60 hover:text-foreground"
                      )}
                      aria-label={t("status")}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-2 shrink-0"
                          style={
                            statusColor
                              ? { backgroundColor: statusColor }
                              : undefined
                          }
                        />
                        <SelectValue>{statusLabel}</SelectValue>
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : readOnly ? (
                  <span
                    className={cn(
                      "flex h-auto items-center gap-1.5 border px-2 py-0.5 text-xs font-medium",
                      "border-border bg-background text-muted-foreground"
                    )}
                    aria-label={t("status")}
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0"
                      style={statusColor ? { backgroundColor: statusColor } : undefined}
                    />
                    <span>{statusLabel}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => !isCancelled && setEditingStatus(true)}
                    disabled={disabled || isCancelled}
                    className={cn(
                      "group flex h-auto items-center gap-1.5 border px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60",
                      hasStatusPending
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border bg-background text-muted-foreground hover:border-brand/60 hover:text-foreground"
                    )}
                    aria-label={t("editStatus")}
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0"
                      style={statusColor ? { backgroundColor: statusColor } : undefined}
                    />
                    <span>{statusLabel}</span>
                    {!isCancelled ? (
                      <PencilIcon className="size-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-90 group-focus-visible:opacity-90" />
                    ) : null}
                  </button>
                )}
                {hasStatusPending ? (
                  <span
                    className="absolute -end-1 -top-1 size-1.5 bg-brand"
                    aria-hidden
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        {booking ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{booking.clientName}</span>
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

      <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
        {booking ? (
          <Badge
            variant={isOverdue ? "default" : "outline"}
            className={
              "max-w-full tabular-nums" +
              (isOverdue ? " bg-brand text-brand-foreground" : "")
            }
            title={t("outstanding")}
          >
            {t("outstanding")}: {formatMoney(outstanding, currency, locale)}
          </Badge>
        ) : null}
        <div className="ms-auto flex shrink-0 items-center gap-2">
          {booking && !readOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEditAll}
            >
              <PencilIcon className="size-3.5" />
              <span className="hidden sm:inline">{tDetail("editAll")}</span>
              <span className="sr-only sm:hidden">{tDetail("editAll")}</span>
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
    </div>
  );
}

// ─── BookingTabs ─────────────────────────────────────────────────────────────

function BookingTabs({
  booking,
  bookingId,
  activity,
  activityTotal,
  actorNames,
  pending,
  draftSessions,
  pendingSessionEdits,
  editingDraftDates,
  editorResetNonce,
  locale,
  reassignedClient,
  eventTypeOptions,
  teams,
  writableTeams,
  readOnly,
  onCommit,
  onDiscard,
  onReassign,
  onClearReassign,
  onViewAllHistory,
  onViewClient,
  viewClientLoading,
  disabled,
  busySessionIdx,
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
  draftPayments,
  pendingPaymentEdits,
  onAddPayment,
  onUpdateDraftPayment,
  onUpdateDraftPaymentStatus,
  onUpdateDraftPaymentTitle,
  onRemoveDraftPayment,
  onCommitPaymentEdit,
  removedPaymentIndexes,
  onToggleRemovePayment,
  registerFieldHandle,
  onFieldEditingChange,
}: {
  booking: BookingDoc;
  bookingId: string;
  activity: ActivityEntry[];
  activityTotal: number;
  actorNames: Record<string, string>;
  pending: PendingChanges;
  draftSessions: DraftSession[];
  pendingSessionEdits: Record<number, PendingSessionEdit>;
  editingDraftDates: Record<string, string>;
  editorResetNonce: number;
  locale: string;
  reassignedClient: { id: string; name: string; email: string | null; phone: string | null } | null;
  eventTypeOptions: { value: string; label: string }[];
  teams: BookingTeamOption[];
  writableTeams: BookingTeamOption[];
  readOnly?: boolean;
  onCommit: (key: EditableKey, value: string | number | null) => void;
  onDiscard: (key: EditableKey) => void;
  onReassign: (c: { id: string; name: string; email: string | null; phone: string | null }) => void;
  onClearReassign: () => void;
  onViewAllHistory: () => void;
  onViewClient: () => void;
  viewClientLoading: boolean;
  disabled: boolean;
  /** Session index currently being patched by remove/date-shift — scoped
   *  separately from `disabled` so it doesn't ride on the global save state. */
  busySessionIdx: number | null;
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
  draftPayments: DraftPayment[];
  pendingPaymentEdits: Record<number, PendingPaymentEdit>;
  onAddPayment: () => void;
  onUpdateDraftPayment: (index: number, price: number) => void;
  onUpdateDraftPaymentStatus: (index: number, status: "unpaid" | "paid") => void;
  onUpdateDraftPaymentTitle: (index: number, title: string) => void;
  onRemoveDraftPayment: (draftId: string) => void;
  onCommitPaymentEdit: (index: number, edit: PendingPaymentEdit) => void;
  removedPaymentIndexes: Set<number>;
  onToggleRemovePayment: (idx: number) => void;
  registerFieldHandle: (editKey: string, handle: FieldHandle | null) => void;
  onFieldEditingChange: (editKey: string, editing: boolean) => void;
}) {
  const t = useTranslations("app.bookings.detail.tabs");
  const tPayments = useTranslations("app.bookings.payments");
  const tFields = useTranslations("app.bookings.detail.fields");
  const tSessions = useTranslations("app.bookings.sessions");

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
  const [editingPaymentIndex, setEditingPaymentIndex] = useState<number | null>(null);
  const [editPaymentPrice, setEditPaymentPrice] = useState(0);
  const [editPaymentStatus, setEditPaymentStatus] = useState<"unpaid" | "paid">("unpaid");
  const [editPaymentTitle, setEditPaymentTitle] = useState("");

  const { upcomingSessions, pastSessions } = useMemo(() => {
    const allSessions = booking?.sessions ?? [];
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
  }, [booking?.sessions]);

  const hasPastSessions = pastSessions.length > 0;
  const visibleSessions = showPast
    ? [...upcomingSessions, ...pastSessions]
    : upcomingSessions;

  const [reassignOpen, setReassignOpen] = useState(false);

  // H2: The contact block shows the staged reassigned client when a clientId
  // change is pending, otherwise falls back to booking.client.
  const clientIdPending = "clientId" in pending;
  const displayClient = clientIdPending && reassignedClient
    ? reassignedClient
    : booking.client;

  // H3: Reassignment is blocked server-side for multi-session bookings.
  // Hide the "Change client" trigger up front to avoid a foreseeable 422.
  const isMultiSession = booking.sessions.length > 1;

  const tWiz = useTranslations("app.bookings.wizard");
  const tTeam = useTranslations("app.bookings.teamPicker");
  const isCancelled = booking.status === "cancelled";

  // Team is editable only when the caller can choose among >1 writable teams.
  // Options are the writable (active, owned/led) teams; the saved display name
  // is resolved from the full `teams` list so a booking assigned to a team the
  // user can't write to (or an inactive one) still shows its real name.
  const showTeamField = writableTeams.length > 1;
  const teamOptions = useMemo(
    () => writableTeams.map((tm) => ({ value: tm.id, label: tm.name })),
    [writableTeams]
  );
  const teamDisplay = (v: string | number | null | undefined) => {
    if (!v) return "—";
    const tm = teams.find((t) => t.id === String(v));
    if (!tm) return "—";
    return tm.isActive ? tm.name : `${tm.name} (${tTeam("inactive")})`;
  };

  return (
    <Tabs defaultValue="client">
      {/* Same subtle base treatment as the client detail modal's tabs (bare
          TabsTab → active tab gets the foreground underline) for cross-modal
          consistency. min-h-11 keeps the touch target ≥44px and overflow-x-auto
          lets the four tabs scroll at 375px. */}
      <TabsList className="grid h-auto w-full grid-cols-5">
        <TabsTab
          value="client"
          aria-label={t("client")}
          className="min-h-11 px-2 sm:px-3"
        >
          <UserIcon className="size-4 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">{t("client")}</span>
        </TabsTab>
        <TabsTab
          value="eventPricing"
          aria-label={t("eventPricing")}
          className="min-h-11 px-2 sm:px-3"
        >
          <CalendarDaysIcon className="size-4 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">{t("eventPricing")}</span>
        </TabsTab>
        <TabsTab
          value="payments"
          aria-label={t("payments")}
          className="min-h-11 px-2 sm:px-3"
        >
          <CreditCardIcon className="size-4 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">{t("payments")}</span>
        </TabsTab>
        <TabsTab
          value="sessionsLocation"
          aria-label={t("sessionsLocation")}
          className="min-h-11 px-2 sm:px-3"
        >
          <MapPinIcon className="size-4 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">{t("sessionsLocation")}</span>
        </TabsTab>
        <TabsTab
          value="activity"
          aria-label={t("activity")}
          className="min-h-11 px-2 sm:px-3"
        >
          <HistoryIcon className="size-4 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">{t("activity")}</span>
        </TabsTab>
      </TabsList>

      <TabsPanel value="client">
        {/* Client contact block — read-only snapshot.
            H2: uses displayClient (staging-aware) instead of booking.client directly.
            L2: Open client links to /clients — the clients page uses a state-based
                modal (no /clients/[id] route and no ?client= deep-link param exists). */}
        <div className="mb-3 flex flex-col gap-2 border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tFields("clientName")}
              </span>
              <span className="truncate text-sm font-medium text-foreground">
                {displayClient?.name ?? booking.clientName}
              </span>
              {displayClient?.email ? (
                <a
                  href={`mailto:${displayClient.email}`}
                  className="truncate text-xs text-brand underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  aria-label={tFields("sendEmail")}
                >
                  {displayClient.email}
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">{tFields("noEmail")}</span>
              )}
              {displayClient?.phone ? (
                <a
                  href={`tel:${displayClient.phone}`}
                  className="text-xs text-brand underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  aria-label={tFields("callClient")}
                >
                  {displayClient.phone}
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">{tFields("noPhone")}</span>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              {booking.client ? (
                <button
                  type="button"
                  onClick={onViewClient}
                  disabled={viewClientLoading}
                  aria-disabled={viewClientLoading}
                  aria-label={tFields("viewClient")}
                  className="flex min-h-11 items-center justify-center gap-1.5 border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand focus-visible:border-brand focus-visible:text-brand focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  {viewClientLoading ? (
                    <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ArrowUpRightIcon className="size-3.5" aria-hidden />
                  )}
                  {tFields("viewClient")}
                </button>
              ) : null}
              {!isMultiSession && !reassignOpen && !readOnly ? (
                <button
                  type="button"
                  onClick={() => setReassignOpen(true)}
                  disabled={disabled}
                  className="flex min-h-11 items-center justify-center gap-1.5 border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand focus-visible:border-brand focus-visible:text-brand focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  {tFields("changeClient")}
                </button>
              ) : null}
            </div>
          </div>
          {/* Reassign client — H3: hidden for multi-session bookings (server rejects it). */}
          {isMultiSession ? (
            <p className="text-xs text-muted-foreground">
              {tFields("changeClientMultiSession")}
            </p>
          ) : reassignOpen ? (
            <ClientReassignPicker
              onSelect={(c) => {
                onReassign(c);
                setReassignOpen(false);
              }}
              onCancel={() => {
                onClearReassign();
                setReassignOpen(false);
              }}
              disabled={disabled}
            />
          ) : null}
        </div>
      </TabsPanel>

      {/* eventPricing: event type + team (side by side) then pricing fields.
          Both event type and team use the pill + pencil reveal pattern — the
          dropdown only mounts once the user clicks the pencil. */}
      <TabsPanel value="eventPricing">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <EditableField
            label={tFields("eventType")}
            type="select"
            options={eventTypeOptions}
            {...get("eventType")}
            onCommit={(v) => onCommit("eventType", v)}
            onDiscardPending={() => onDiscard("eventType")}
            disabled={disabled || isCancelled || !!readOnly}
            readOnly={!!readOnly}
            editKey="eventType"
            registerHandle={registerFieldHandle}
            onEditingChange={onFieldEditingChange}
          />
          {showTeamField ? (
            <EditableField
              label={tWiz("teamLabel")}
              type="select"
              options={teamOptions}
              formatDisplay={teamDisplay}
              {...get("teamId")}
              onCommit={(v) => onCommit("teamId", v || null)}
              onDiscardPending={() => onDiscard("teamId")}
              disabled={disabled || isCancelled || !!readOnly}
              readOnly={!!readOnly}
              editKey="teamId"
              registerHandle={registerFieldHandle}
              onEditingChange={onFieldEditingChange}
            />
          ) : null}
        </div>

        {/* Location — moved from sessions tab */}
        <SectionHeader label={tFields("location")} />
        <div className="flex flex-col gap-1 py-1.5">
          {readOnly ? (
            <>
              <LocationDisplay
                value={{
                  address: booking.location?.address ?? "",
                  lat: booking.location?.lat ?? null,
                  lng: booking.location?.lng ?? null,
                }}
              />
              {booking.location?.lat != null && booking.location?.lng != null ? (
                <div className="overflow-hidden border border-border">
                  <LocationMap
                    lat={booking.location.lat}
                    lng={booking.location.lng}
                    onPick={() => {}}
                    disabled
                    compact
                    scrollWheelZoom
                  />
                </div>
              ) : null}
            </>
          ) : (
            <LocationPicker
              editable
              value={{
                address:
                  "location.address" in pending
                    ? ((pending["location.address"] as string) ?? "")
                    : (booking.location?.address ?? ""),
                lat:
                  "location.lat" in pending
                    ? (pending["location.lat"] as number | null)
                    : (booking.location?.lat ?? null),
                lng:
                  "location.lng" in pending
                    ? (pending["location.lng"] as number | null)
                    : (booking.location?.lng ?? null),
              }}
              onChange={(v) => {
                onCommit("location.address", v.address);
                onCommit("location.lat", v.lat);
                onCommit("location.lng", v.lng);
              }}
              disabled={disabled}
            />
          )}
        </div>
      </TabsPanel>

      {/* payments: pricing fields + payment list, split out of eventPricing so
          the tab isn't overloaded. */}
      <TabsPanel value="payments">
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
            disabled={disabled || !!readOnly}
            readOnly={!!readOnly}
            editKey="amount.total"
            registerHandle={registerFieldHandle}
            onEditingChange={onFieldEditingChange}
          />
          <EditableField
            label={tFields("deposit")}
            type="money"
            currency={currency}
            formatDisplay={(v) => formatMoney(Number(v) || 0, currency, locale)}
            {...get("amount.deposit")}
            onCommit={(v) => onCommit("amount.deposit", v)}
            onDiscardPending={() => onDiscard("amount.deposit")}
            disabled={disabled || !!readOnly}
            readOnly={!!readOnly}
            validate={(v) => {
              const n = Number(v);
              if (Number.isFinite(n) && n > 0 && total <= 0) {
                return tFields("depositRequiresTotal");
              }
              if (Number.isFinite(n) && n > total) {
                return tFields("depositExceedsTotal");
              }
              return null;
            }}
            editKey="amount.deposit"
            registerHandle={registerFieldHandle}
            onEditingChange={onFieldEditingChange}
          />
          <EditableField
            label={tFields("currency")}
            type="select"
            options={currencyOptions}
            {...get("amount.currency")}
            onCommit={(v) => onCommit("amount.currency", v)}
            onDiscardPending={() => onDiscard("amount.currency")}
            disabled={disabled || !!readOnly}
            readOnly={!!readOnly}
            editKey="amount.currency"
            registerHandle={registerFieldHandle}
            onEditingChange={onFieldEditingChange}
          />
        </div>

        <SectionHeader label={tSections("payments")} />
        {(() => {
          const depositForAddGate =
            (pending["amount.deposit"] as number) ?? booking.amount.deposit;
          const remainingPaymentsCount = booking.payments.length - removedPaymentIndexes.size;
          const allPaymentsForGate = [
            ...booking.payments
              .map((p, i) => ({ price: pendingPaymentEdits[i]?.price ?? p.price, i }))
              .filter(({ i }) => !removedPaymentIndexes.has(i)),
            ...draftPayments.map((d) => ({ price: d.price })),
          ];
          const noBalanceRemaining =
            remainingBalance(allPaymentsForGate, { total, deposit: depositForAddGate }) <= 0;
          return remainingPaymentsCount <= 0 && draftPayments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">{tPayments("empty")}</p>
            {!readOnly ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddPayment}
                disabled={disabled || noBalanceRemaining}
              >
                <PlusIcon className="size-4" />
                {tPayments("add")}
              </Button>
            ) : null}
          </div>
        ) : (
          <>
        <div className="flex flex-col gap-2">
          {booking.payments.map((payment, idx) => {
            if (removedPaymentIndexes.has(idx)) return null;
            const edit = pendingPaymentEdits[idx];
            const effectivePrice = edit?.price ?? payment.price;
            const effectiveStatus = edit?.status ?? payment.status;
            const effectiveTitle = edit?.title ?? payment.title;
            const depositForCap =
              (pending["amount.deposit"] as number) ?? booking.amount.deposit;
            const otherPayments = [
              ...booking.payments.map((p, i) => ({
                price: removedPaymentIndexes.has(i) ? 0 : (pendingPaymentEdits[i]?.price ?? p.price),
              })),
              ...draftPayments.map((d) => ({ price: d.price })),
            ];
            const maxForExisting = remainingBalance(
              otherPayments,
              { total, deposit: depositForCap },
              idx
            );
            const existingExceedsCap =
              editingPaymentIndex === idx && editPaymentPrice > maxForExisting;
            return editingPaymentIndex === idx ? (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`existing-payment-title-${idx}`}>{tPayments("title")}</Label>
                  <Input
                    id={`existing-payment-title-${idx}`}
                    value={editPaymentTitle}
                    onChange={(e) => setEditPaymentTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`existing-payment-price-${idx}`}>{tPayments("price")}</Label>
                    <Input
                      id={`existing-payment-price-${idx}`}
                      type="number"
                      value={editPaymentPrice}
                      onChange={(e) => setEditPaymentPrice(Number(e.target.value) || 0)}
                    />
                    {existingExceedsCap ? (
                      <p className="text-xs text-destructive">{tPayments("exceedsBalance")}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`existing-payment-status-${idx}`}>{tPayments("status")}</Label>
                    <Select<"unpaid" | "paid">
                      value={editPaymentStatus}
                      onValueChange={(v) => v && setEditPaymentStatus(v)}
                    >
                      <SelectTrigger id={`existing-payment-status-${idx}`}>
                        <SelectValue>{(v: string) => tPayments(v)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">{tPayments("unpaid")}</SelectItem>
                        <SelectItem value="paid">{tPayments("paid")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={existingExceedsCap}
                  onClick={() => {
                    onCommitPaymentEdit(idx, {
                      price: editPaymentPrice,
                      status: editPaymentStatus,
                      title: editPaymentTitle,
                    });
                    setEditingPaymentIndex(null);
                  }}
                  className="self-start"
                >
                  {tFields("confirmTitle")}
                </Button>
              </div>
            ) : (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 border border-border px-2.5 py-1.5"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {effectiveTitle || tPayments("label", { n: idx + 1 })}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatMoney(effectivePrice, booking.amount.currency, locale)}
                  </span>
                  <Badge variant={effectiveStatus === "paid" ? "default" : "outline"}>
                    {tPayments(effectiveStatus)}
                  </Badge>
                  {payment.paidAt ? (
                    <span className="text-xs text-muted-foreground">
                      {tPayments("paidOn", {
                        date: new Date(payment.paidAt).toLocaleDateString(locale),
                      })}
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Edit ${tPayments("label", { n: idx + 1 })}`}
                  onClick={() => {
                    setEditPaymentPrice(effectivePrice);
                    setEditPaymentStatus(effectiveStatus);
                    setEditPaymentTitle(effectiveTitle);
                    setEditingPaymentIndex(idx);
                  }}
                >
                  <PencilIcon className="size-4" />
                </Button>
                {!readOnly ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${tPayments("label", { n: idx + 1 })}`}
                    onClick={() => onToggleRemovePayment(idx)}
                    className="text-muted-foreground hover:text-destructive focus-visible:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                ) : null}
              </div>
            );
          })}
          {draftPayments.map((draft, idx) => {
            const depositForCap =
              (pending["amount.deposit"] as number) ?? booking.amount.deposit;
            const otherPayments = [
              ...booking.payments.map((p, i) => ({
                price: removedPaymentIndexes.has(i) ? 0 : (pendingPaymentEdits[i]?.price ?? p.price),
              })),
              ...draftPayments.map((d) => ({ price: d.price })),
            ];
            const maxForDraft = remainingBalance(
              otherPayments,
              { total, deposit: depositForCap },
              booking.payments.length + idx
            );
            const exceedsCap = draft.price > maxForDraft;
            return (
            <div key={draft.draftId} className="flex flex-col gap-1">
            <div className="flex items-end gap-2">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`payment-title-${idx}`}>{tPayments("title")}</Label>
                <Input
                  id={`payment-title-${idx}`}
                  value={draft.title}
                  onChange={(e) => onUpdateDraftPaymentTitle(idx, e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`payment-price-${idx}`}>{tPayments("price")}</Label>
                <Input
                  id={`payment-price-${idx}`}
                  type="number"
                  value={draft.price}
                  onChange={(e) => onUpdateDraftPayment(idx, Number(e.target.value) || 0)}
                />
                {exceedsCap ? (
                  <p className="text-xs text-destructive">{tPayments("exceedsBalance")}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`payment-status-${idx}`}>{tPayments("status")}</Label>
                <Select<"unpaid" | "paid">
                  value={draft.status}
                  onValueChange={(v) => v && onUpdateDraftPaymentStatus(idx, v)}
                >
                  <SelectTrigger id={`payment-status-${idx}`}>
                    <SelectValue>{(v: string) => tPayments(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">{tPayments("unpaid")}</SelectItem>
                    <SelectItem value="paid">{tPayments("paid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!readOnly ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => onRemoveDraftPayment(draft.draftId)}
                aria-label={tPayments("remove")}
                className="text-muted-foreground hover:text-destructive focus-visible:text-destructive"
              >
                <XIcon className="size-4" />
              </Button>
            ) : null}
            </div>
            </div>
            );
          })}
        </div>
        {!readOnly ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddPayment}
            disabled={disabled || noBalanceRemaining}
            className="self-start"
          >
            <PlusIcon className="size-4" />
            {tPayments("add")}
          </Button>
        ) : null}
          </>
          );
        })()}
      </TabsPanel>

      {/* sessionsLocation: sessions only */}
      <TabsPanel value="sessionsLocation">
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

        {/* Sessions list — only this region scrolls (mirrors the wizard). */}
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
            const pendingEdit = pendingSessionEdits[resolvedIdx];
            const committedDate = hasPendingEdit
              ? isoDate(pendingEdit.startAt)
              : isoDate(s.startAt);
            // For conflict display: while editing use in-flight date; otherwise use committed.
            const effectiveDateForConflict = inFlightDate ?? committedDate;
            const rawShifts = shiftsByDate.get(effectiveDateForConflict) ?? [];
            // Filter raw shifts by time overlap using the committed/pending times.
            // The strict half-open predicate (aStart < bEnd && bStart < aEnd) matches
            // the wizard's canonical pattern. Also exclude any shift that belongs to
            // this booking (defense in depth — the API should already exclude them via
            // excludeId, but a stale cache entry or race condition could slip one through).
            const effectiveStartTime = pendingEdit
              ? hhmm(pendingEdit.startAt)
              : hhmm(s.startAt);
            const effectiveEndTime = pendingEdit
              ? hhmm(pendingEdit.endAt)
              : hhmm(s.endAt);
            const aStart = toMinutes(effectiveStartTime);
            const aEnd = toMinutes(effectiveEndTime);
            const sessionConflicts =
              aStart == null || aEnd == null || aEnd <= aStart
                ? rawShifts.filter((sh) => sh.bookingId !== bookingId)
                : rawShifts.filter((sh) => {
                    if (sh.bookingId === bookingId) return false;
                    const bStart = toMinutes(sh.shiftStart);
                    const bEnd = toMinutes(sh.shiftEnd);
                    if (bStart == null || bEnd == null) return false;
                    return aStart < bEnd && bStart < aEnd;
                  });
            const isLoadingConflict = loadingDates.has(effectiveDateForConflict);
            return (
              <SessionCard
                key={`${s.startAt}-${s.endAt}-${editorResetNonce}`}
                session={s}
                sessionIndex={resolvedIdx}
                total={(booking?.sessions ?? []).length}
                locale={locale}
                disabled={disabled || busySessionIdx !== null}
                busy={busySessionIdx === resolvedIdx}
                readOnly={readOnly}
                isPast={isPastSession(s)}
                label={tSessions("label", { n: resolvedIdx + 1 })}
                removeLabel={tSessions("remove")}
                unsavedLabel={tSessions("unsaved")}
                hasPendingEdit={hasPendingEdit}
                pendingEdit={pendingEdit}
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
            const rawDraftShifts = shiftsByDate.get(effectiveDateForConflict) ?? [];
            // Filter draft conflicts by time overlap (same predicate as the wizard).
            const draftAStart = toMinutes(hhmm(draft.startAt));
            const draftAEnd = toMinutes(hhmm(draft.endAt));
            const draftConflicts =
              draftAStart == null || draftAEnd == null || draftAEnd <= draftAStart
                ? rawDraftShifts.filter((sh) => sh.bookingId !== bookingId)
                : rawDraftShifts.filter((sh) => {
                    if (sh.bookingId === bookingId) return false;
                    const bStart = toMinutes(sh.shiftStart);
                    const bEnd = toMinutes(sh.shiftEnd);
                    if (bStart == null || bEnd == null) return false;
                    return draftAStart < bEnd && bStart < draftAEnd;
                  });
            return draft.locked ? (
              <LockedDraftCard
                key={draft.draftId}
                draft={draft}
                locale={locale}
                disabled={disabled}
                readOnly={readOnly}
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
                readOnly={readOnly}
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
        {!readOnly ? (
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
        ) : null}

      </TabsPanel>

      <TabsPanel value="activity">
        <EditableField
          label={tFields("notes")}
          type="textarea"
          {...get("notes")}
          onCommit={(v) => onCommit("notes", v)}
          onDiscardPending={() => onDiscard("notes")}
          disabled={disabled}
          readOnly={readOnly}
          editKey="notes"
          registerHandle={registerFieldHandle}
          onEditingChange={onFieldEditingChange}
        />

        <SectionHeader label={tSections("history")} />
        <ActivityTimeline
          entries={activity.slice(0, 5)}
          locale={locale}
          currency={currency}
          actorNames={actorNames}
        />
        {activityTotal > 5 && activity.length > 0 ? (
          <button
            type="button"
            onClick={onViewAllHistory}
            className="mt-2 self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
          >
            {tFields("viewAllHistory", { count: activityTotal })}
          </button>
        ) : null}
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
  busy,
  readOnly,
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
  /** True while THIS session's own remove/date-shift patch is in flight —
   *  drives a scoped spinner distinct from the shared `disabled` state. */
  busy?: boolean;
  readOnly?: boolean;
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
  const timeMode = useTimeFormat();

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
  const [expanded, setExpanded] = useState(true);
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
    setExpanded(true);
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
    <CollapsibleDrawer
      title={
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
      }
      subtitle={
        displayStart ? (
          <span className="text-xs text-muted-foreground">
            {formatSessionStamp(displayStart, locale, timeMode)}
          </span>
        ) : null
      }
      actions={
        !readOnly ? (
          <>
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
              aria-busy={busy ? "true" : undefined}
              title={isOnlySession ? removeLabel : undefined}
              aria-label={removeLabel}
              className={cn(
                "text-muted-foreground",
                !isOnlySession &&
                  "hover:text-destructive focus-visible:text-destructive"
              )}
            >
              {busy ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <Trash2Icon className="size-4" />
              )}
            </Button>
          </>
        ) : null
      }
      open={expanded}
      onOpenChange={setExpanded}
      className={cn(
        hasPendingEdit ? "border-brand" : "border-border",
        isPast && !editing && "opacity-60"
      )}
      bodyClassName="max-h-80 overflow-y-auto"
    >
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
                  ? formatSessionStamp(displayStart, locale, timeMode)
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
                  ? formatSessionStamp(displayEnd, locale, timeMode)
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
                lang={TIME_INPUT_LANG[timeMode]}
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
                lang={TIME_INPUT_LANG[timeMode]}
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
    </CollapsibleDrawer>
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
  readOnly,
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
  readOnly?: boolean;
  label: string;
  unsavedLabel: string;
  removeLabel: string;
  conflicts: ShiftHit[];
  loadingConflict: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const tFields = useTranslations("app.bookings.detail.fields");
  const timeMode = useTimeFormat();
  const sessionDate = isoDate(draft.startAt);
  return (
    <CollapsibleDrawer
      title={
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="inline-flex items-center border border-brand bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
            {unsavedLabel}
          </span>
        </div>
      }
      subtitle={
        draft.startAt ? (
          <span className="text-xs text-muted-foreground">
            {formatSessionStamp(draft.startAt, locale, timeMode)}
          </span>
        ) : null
      }
      actions={
        !readOnly ? (
          <>
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
          </>
        ) : null
      }
      defaultOpen
      className="border-brand"
      bodyClassName="max-h-80 overflow-y-auto"
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tFields("startAt")}
          </span>
          <span className="text-sm text-foreground">
            {draft.startAt
              ? formatSessionStamp(draft.startAt, locale, timeMode)
              : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tFields("endAt")}
          </span>
          <span className="text-sm text-foreground">
            {draft.endAt
              ? formatSessionStamp(draft.endAt, locale, timeMode)
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
    </CollapsibleDrawer>
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
  readOnly,
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
  readOnly?: boolean;
  label: string;
  conflicts: ShiftHit[];
  isCheckingConflicts: boolean;
  onDiscard: () => void;
  onUpdate: (startAt: string, endAt: string) => void;
  onLock: () => void;
  onDraftDateChange: (date: string | null) => void;
}) {
  const tFields = useTranslations("app.bookings.detail.fields");
  const timeMode = useTimeFormat();

  // Suppress unused-variable lint — draftIndex is bound by the caller's closure.
  void draftIndex;
  // locale is used for the conflict alert.
  void locale;

  const [draftStartDate, setDraftStartDate] = useState(isoDate(draft.startAt));
  const [draftStartTime, setDraftStartTime] = useState(hhmm(draft.startAt));
  const [draftEndTime, setDraftEndTime] = useState(hhmm(draft.endAt));
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
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
    <CollapsibleDrawer
      title={
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="inline-flex items-center border border-brand/50 bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
            draft
          </span>
        </div>
      }
      subtitle={
        draft.startAt ? (
          <span className="text-xs text-muted-foreground">
            {formatSessionStamp(draft.startAt, locale, timeMode)}
          </span>
        ) : null
      }
      actions={
        !readOnly ? (
          <>
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
          </>
        ) : null
      }
      open={expanded}
      onOpenChange={setExpanded}
      className="border-dashed border-brand bg-muted/30"
      bodyClassName="max-h-80 overflow-y-auto"
    >
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
              lang={TIME_INPUT_LANG[timeMode]}
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
              lang={TIME_INPUT_LANG[timeMode]}
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
    </CollapsibleDrawer>
  );
}

// ─── ClientReassignPicker ─────────────────────────────────────────────────────

type ClientSearchHit = { id: string; name: string; email: string | null; phone: string | null };

function ClientReassignPicker({
  onSelect,
  onCancel,
  disabled,
}: {
  onSelect: (client: ClientSearchHit) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const tFields = useTranslations("app.bookings.detail.fields");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();

    // Show initial list when empty, debounce on non-empty.
    // All state updates happen inside the setTimeout callback to avoid
    // synchronous setState calls in the effect body (React Compiler rule).
    let cancelled = false;
    debounceRef.current = setTimeout(
      async () => {
        if (cancelled) return;
        setSearchError(null);
        setSearching(true);
        try {
          const params = new URLSearchParams({ limit: "20" });
          if (q) params.set("q", q);
          const res = await fetch(`/api/clients?${params.toString()}`);
          if (cancelled) return;
          if (!res.ok) throw new Error("Search failed");
          const data = await res.json() as ClientSearchHit[];
          if (!cancelled) setResults(data);
        } catch {
          if (!cancelled) {
            setSearchError(tFields("searchFailed"));
            setResults([]);
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      },
      q ? 250 : 0
    );

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="mt-1 flex flex-col gap-2 border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{tFields("changeClient")}</span>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className={cn(
            "text-xs text-muted-foreground transition-colors",
            "hover:text-foreground focus-visible:text-foreground focus-visible:outline-none",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          {tFields("changeClientCancel")}
        </button>
      </div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tFields("changeClientSearch")}
          className="h-8 ps-8 text-sm"
          disabled={disabled}
          aria-label={tFields("changeClientSearch")}
        />
      </div>
      <div className="max-h-48 overflow-y-auto border border-border bg-background">
        {searching ? (
          <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
          </div>
        ) : searchError ? (
          <p className="px-3 py-4 text-center text-xs text-destructive">{searchError}</p>
        ) : results.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {tFields("noClientResults")}
          </p>
        ) : (
          <ul className="flex flex-col">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                    onSelect(c);
                  }}
                  disabled={disabled}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-start text-sm transition-colors last:border-b-0",
                    "hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none",
                    "active:bg-accent/60",
                    "disabled:pointer-events-none disabled:opacity-50",
                    selectedId === c.id && "bg-accent text-accent-foreground"
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{c.name}</span>
                    {c.email ? (
                      <span className="truncate text-xs text-muted-foreground">{c.email}</span>
                    ) : null}
                  </span>
                  {selectedId === c.id ? <CheckIcon className="size-4 shrink-0" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
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
  completed,
  hasPayments,
  bookingId,
  hasPending,
  pendingCount,
  saving,
  saveError,
  saveBlocked,
  businessComplete,
  workspaceId,
  onToggleCancel,
  onDiscard,
  onSave,
}: {
  cancelled: boolean;
  completed: boolean;
  hasPayments: boolean;
  bookingId: string;
  hasPending: boolean;
  pendingCount: number;
  saving: boolean;
  saveError: string | null;
  saveBlocked: boolean;
  businessComplete: boolean;
  workspaceId: string;
  onToggleCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const t = useTranslations("app.bookings.detail");
  const tWarn = useTranslations("app.bookings.detail.incompleteBusiness");
  const [incompleteWarningOpen, setIncompleteWarningOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const downloadUrl = `/api/bookings/${bookingId}/${completed ? "receipt" : "invoice"}`;
  const hideFlagKey = `gw_hide_incomplete_business_warning:${workspaceId}`;

  function openDownload() {
    if (downloading) return;
    setDownloading(true);
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setDownloading(false), 800);
  }

  function handleDownloadClick() {
    if (downloading) return;
    if (!businessComplete && !window.localStorage.getItem(hideFlagKey)) {
      setIncompleteWarningOpen(true);
      return;
    }
    openDownload();
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3">
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
          {hasPayments ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadClick}
              disabled={saving}
            >
              <DownloadIcon className="size-4" />
              {completed ? t("receipt") : t("invoice")}
            </Button>
          ) : null}
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

      <Dialog open={incompleteWarningOpen} onOpenChange={setIncompleteWarningOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-3rem)] flex-col gap-0 overflow-hidden p-2">
          <DialogHeader className="shrink-0 p-4">
            <DialogTitle>{tWarn("title")}</DialogTitle>
            <DialogDescription>
              {completed ? tWarn("bodyReceipt") : tWarn("bodyInvoice")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="shrink-0 gap-2 border-t border-border p-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                window.localStorage.setItem(hideFlagKey, "1");
                setIncompleteWarningOpen(false);
                openDownload();
              }}
            >
              {tWarn("dontShowAgain")}
            </Button>
            <div className="flex items-center gap-2 justify-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIncompleteWarningOpen(false)}
              >
                {tWarn("cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setIncompleteWarningOpen(false);
                  openDownload();
                }}
              >
                {tWarn("downloadAnyway")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    case "location.lat":
      return booking.location?.lat ?? null;
    case "location.lng":
      return booking.location?.lng ?? null;
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
    } else if (k === "location.lat") {
      next.location.lat = value == null ? null : Number(value);
    } else if (k === "location.lng") {
      next.location.lng = value == null ? null : Number(value);
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
  t: { (key: string): string; has?: (key: string) => boolean },
  key: string,
  fallback: string
): string {
  if (!key) return fallback;
  try {
    // next-intl's t.has() checks existence without firing the onError logger,
    // so an unknown/empty key never produces a MISSING_MESSAGE console error.
    if (typeof t.has === "function" && !t.has(key)) return fallback;
    const v = t(key);
    return v && v !== key ? v : fallback;
  } catch {
    return fallback;
  }
}
