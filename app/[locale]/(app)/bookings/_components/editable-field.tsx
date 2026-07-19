"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TIME_INPUT_LANG, formatTime } from "@/lib/utils/time-format";
import { useTimeFormat } from "@/lib/time-format/context";

export type EditableFieldType =
  | "text"
  | "textarea"
  | "select"
  | "date"
  | "datetime"
  | "money";

type SelectOption = { value: string; label: string };

/**
 * A stable handle that the parent can use to observe and control an open editor
 * without re-implementing validation. Register via the `registerHandle` prop.
 * All methods read live values via a ref so they are never stale.
 */
export type FieldHandle = {
  isEditing: () => boolean;
  isDirty: () => boolean;
  /** True iff the field is dirty AND passes validate(). */
  canCommit: () => boolean;
  /** The normalized value the user has typed in the open editor. */
  getNormalizedValue: () => string | number | null;
  /** Close the editor and discard the in-progress draft (equivalent to ✗). */
  cancel: () => void;
};

type Props = {
  label: string;
  /** The server-truth value (what's currently saved). */
  value: string | number | null | undefined;
  /** The pending value if the user has made an unsaved change to this field. */
  pendingValue?: string | number | null;
  /** Whether this field currently has a pending change. */
  hasPending?: boolean;
  type: EditableFieldType;
  /** For type="select" only. */
  options?: SelectOption[];
  /** For type="money" — currency code (PHP, USD, etc.) shown as an adornment. */
  currency?: string;
  /** For type="date" and "datetime" — lower bound (YYYY-MM-DD). */
  min?: string;
  /** Render the read-state value (defaults to formatting `value` as text). */
  formatDisplay?: (v: string | number | null | undefined) => string;
  /** Optional inline validation; return a string error to block commit. */
  validate?: (v: string | number | null) => string | null;
  /**
   * Called when the user clicks the check mark with a valid value. The parent
   * is responsible for writing it to its pending-changes map.
   */
  onCommit: (newValue: string | number | null) => void;
  /**
   * Called when the user explicitly clears the pending value for this field
   * via the discard control.
   */
  onDiscardPending?: () => void;
  disabled?: boolean;
  /** When true, hides all edit controls entirely (pencil, confirm, cancel). */
  readOnly?: boolean;

  // ── Parent-observation API (optional) ────────────────────────────────────
  /**
   * Stable identifier for this field (e.g. the EditableKey string). Required
   * for the observation callbacks to fire. If absent, all three callbacks are
   * silently skipped so existing call sites need no changes.
   */
  editKey?: string;
  /**
   * Called whenever the editor opens (`editing=true`) or closes (`editing=false`).
   * The parent uses this to track how many fields are currently open.
   */
  onEditingChange?: (editKey: string, editing: boolean) => void;
  /**
   * Called on mount with a stable `FieldHandle` (and on unmount with `null`).
   * The parent stores the handle in a Map and uses it to programmatically
   * commit or cancel the in-progress edit.
   */
  registerHandle?: (editKey: string, handle: FieldHandle | null) => void;
};

export function EditableField({
  label,
  value,
  pendingValue,
  hasPending,
  type,
  options,
  currency,
  min,
  formatDisplay,
  validate,
  onCommit,
  onDiscardPending,
  disabled,
  readOnly,
  editKey,
  onEditingChange,
  registerHandle,
}: Props) {
  const timeMode = useTimeFormat();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | number | null>(
    hasPending ? (pendingValue ?? null) : (value ?? null)
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Keep a ref to the latest live values so the FieldHandle never captures
  // stale closures (the handle object itself is stable — created once).
  const liveRef = useRef({
    editing,
    draft,
    isDirty: false,
    canCommit: false,
    cancelEdit: () => {},
  });

  // When the parent's server-truth value or pending value changes (e.g. after
  // a save settles or a discard fires), pull the draft back in sync.
  useEffect(() => {
    if (editing) return;
    const next = hasPending ? (pendingValue ?? null) : (value ?? null);
    Promise.resolve().then(() => {
      setDraft(next);
      setError(null);
    });
  }, [value, pendingValue, hasPending, editing]);

  function startEdit() {
    if (disabled) return;
    setDraft(hasPending ? (pendingValue ?? null) : (value ?? null));
    setError(null);
    setEditing(true);
    if (editKey) onEditingChange?.(editKey, true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setError(null);
    setEditing(false);
    if (editKey) onEditingChange?.(editKey, false);
  }

  function commit() {
    const v = normalize(draft, type);
    const localErr = validate?.(v);
    if (localErr) {
      setError(localErr);
      return;
    }
    onCommit(v);
    setEditing(false);
    setError(null);
    if (editKey) onEditingChange?.(editKey, false);
  }

  /** The value that was active when the user opened the editor. */
  const originalValue = hasPending ? (pendingValue ?? null) : (value ?? null);
  const normalizedDraft = normalize(draft, type);
  const normalizedOriginal = normalize(originalValue, type);
  const isDirty = String(normalizedDraft) !== String(normalizedOriginal);
  const validationError = validate?.(normalizedDraft) ?? null;
  const canCommit = isDirty && !validationError;

  // Keep the live ref current after each commit. Writing a ref during render is
  // disallowed; an effect with no dependency array runs on every render, and
  // handle methods (read only post-mount via user interaction) see fresh values.
  useEffect(() => {
    liveRef.current = { editing, draft, isDirty, canCommit, cancelEdit };
  });

  // Register / unregister the stable FieldHandle on mount / unmount.
  // The handle itself is created once (stable object identity) and always reads
  // from liveRef so it is never stale.
  useEffect(() => {
    if (!editKey || !registerHandle) return;

    const handle: FieldHandle = {
      isEditing: () => liveRef.current.editing,
      isDirty: () => liveRef.current.isDirty,
      canCommit: () => liveRef.current.canCommit,
      getNormalizedValue: () => normalize(liveRef.current.draft, type),
      cancel: () => liveRef.current.cancelEdit(),
    };

    registerHandle(editKey, handle);
    return () => {
      registerHandle(editKey, null);
    };
    // editKey and type are intentionally omitted from deps: handle identity is
    // stable and liveRef always contains the latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentDisplay = (() => {
    const v = hasPending ? (pendingValue ?? null) : (value ?? null);
    if (formatDisplay) return formatDisplay(v);
    if (v == null || v === "") return "—";
    if (type === "select" && options) {
      return options.find((o) => o.value === String(v))?.label ?? String(v);
    }
    if (type === "date" && v) {
      return new Date(String(v)).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    if (type === "datetime" && v) {
      const d = new Date(String(v));
      const datePart = d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const timePart = formatTime(d, timeMode);
      return `${datePart} · ${timePart}`;
    }
    return String(v);
  })();

  return (
    <div className="flex min-w-0 flex-col gap-1 py-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>

          {!editing ? (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm",
                  hasPending && "font-medium text-foreground",
                  !hasPending && "text-foreground"
                )}
              >
                {currentDisplay}
              </span>
              {hasPending ? (
                <>
                  <span
                    className="inline-block size-1.5 bg-primary"
                    aria-label="unsaved"
                    title="Unsaved change"
                  />
                  {onDiscardPending ? (
                    <button
                      type="button"
                      onClick={onDiscardPending}
                      className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                    >
                      revert
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {type === "text" || type === "date" ? (
                <Input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type={type === "date" ? "date" : "text"}
                  min={type === "date" ? min : undefined}
                  value={toInputValue(draft, type)}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
              ) : type === "datetime" ? (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="date"
                    min={min}
                    value={datetimeParts(draft).date}
                    onChange={(e) =>
                      setDraft(
                        combineDatetime(
                          e.target.value,
                          datetimeParts(draft).time
                        )
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  <Input
                    type="time"
                    lang={TIME_INPUT_LANG[timeMode]}
                    className="w-32"
                    value={datetimeParts(draft).time}
                    onChange={(e) =>
                      setDraft(
                        combineDatetime(
                          datetimeParts(draft).date,
                          e.target.value
                        )
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                </div>
              ) : type === "textarea" ? (
                <Textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  value={toInputValue(draft, type)}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelEdit();
                  }}
                  rows={4}
                />
              ) : type === "money" ? (
                <div className="flex items-center gap-2">
                  {currency ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {currency}
                    </span>
                  ) : null}
                  <Input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="1"
                    value={toInputValue(draft, type)}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                </div>
              ) : type === "select" && options ? (
                <Select<string>
                  value={String(draft ?? "")}
                  onValueChange={(v) => setDraft(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={label}>
                      {options.find((opt) => opt.value === String(draft ?? ""))?.label ?? label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {error ? (
                <span className="text-xs text-destructive">{error}</span>
              ) : null}
            </div>
          )}
        </div>

        {!readOnly ? (
          <div className="flex shrink-0 items-center gap-1">
            {editing ? (
              <>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={commit}
                  aria-label="Confirm"
                  disabled={!canCommit}
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
          </div>
        ) : null}
      </div>
    </div>
  );
}

function normalize(
  v: string | number | null,
  type: EditableFieldType
): string | number | null {
  if (v == null) return null;
  if (type === "money") {
    if (v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "date") {
    if (typeof v === "string") {
      // accept YYYY-MM-DD from date input → convert to ISO
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + "T00:00:00").toISOString();
      return v;
    }
    return null;
  }
  if (type === "datetime") {
    // Already a full ISO (we keep draft as ISO when editor combines parts).
    return typeof v === "string" ? v : null;
  }
  return typeof v === "string" ? v.trim() : v;
}

/** Split an ISO timestamp into local-time date (YYYY-MM-DD) + time (HH:MM)
 *  parts so the two inputs can be controlled independently. */
function datetimeParts(v: string | number | null): {
  date: string;
  time: string;
} {
  if (v == null || v === "") return { date: "", time: "" };
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

/** Combine a date + time (both local) into a full ISO timestamp. */
function combineDatetime(date: string, time: string): string {
  if (!date) return "";
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return new Date(`${date}T${t}:00`).toISOString();
}

function toInputValue(
  v: string | number | null,
  type: EditableFieldType
): string {
  if (v == null) return "";
  if (type === "date") {
    // Render ISO → YYYY-MM-DD for the native date input.
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    return s;
  }
  return String(v);
}
