"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils/format-currency";
import type { ActivityEntry } from "./activity-types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ActivityTimelineProps = {
  entries: ActivityEntry[];
  locale: string;
  currency?: string;
  className?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the local-calendar YYYY-MM-DD for a given date.
 * Uses `toLocaleDateString('en-CA')` which produces YYYY-MM-DD in the
 * Gregorian calendar, based on the browser/runtime local timezone — so
 * grouping and the per-entry toLocaleTimeString agree on which calendar day
 * an event falls on. This prevents UTC-vs-local skew near midnight (e.g. an
 * entry at 06:00 PH local that is 22:00Z the previous day no longer lands in
 * the wrong day bucket).
 */
function localIsoDate(date: Date): string {
  return date.toLocaleDateString("en-CA"); // YYYY-MM-DD in local timezone
}

/** Maps a diff key to { ns, key } for translation lookup. */
function diffKeyToI18n(key: string): { ns: "fields" | "sections"; key: string } | null {
  const fieldMap: Record<string, string> = {
    title: "title",
    eventType: "eventType",
    status: "status",
    "amount.total": "total",
    "amount.deposit": "deposit",
    "amount.currency": "currency",
    "location.address": "location",
    notes: "notes",
    clientName: "clientName",
    clientId: "clientName",
  };
  if (key in fieldMap) return { ns: "fields", key: fieldMap[key] };
  if (key === "sessions") return { ns: "sections", key: "schedule" };
  return null;
}

/** Action → style classes — square corners, border + bg tokens, accessible in both themes. */
const ACTION_STYLES: Record<
  string,
  { pill: string; dot: string }
> = {
  created: {
    pill: "border-brand/40 bg-brand/10 text-brand",
    dot: "bg-brand",
  },
  updated: {
    pill: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  status_changed: {
    pill: "border-border bg-accent text-accent-foreground",
    dot: "bg-accent-foreground",
  },
  client_changed: {
    pill: "border-border bg-secondary text-secondary-foreground",
    dot: "bg-secondary-foreground",
  },
  deleted: {
    pill: "border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

const FALLBACK_STYLE = ACTION_STYLES.updated;

function getActionStyle(action: string) {
  return ACTION_STYLES[action] ?? FALLBACK_STYLE;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionPill({ action, label }: { action: string; label: string }) {
  const style = getActionStyle(action);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        style.pill
      )}
    >
      {label}
    </span>
  );
}

function ChangePill({
  label,
  before,
  after,
  sessionsOnly,
}: {
  label: string;
  before?: string;
  after?: string;
  /** When true, no before→after text is shown — only the label. */
  sessionsOnly?: boolean;
}) {
  const content = sessionsOnly
    ? label
    : `${label}: ${before ?? "—"} → ${after ?? "—"}`;

  return (
    <span
      title={content}
      className="inline-flex max-w-50 shrink-0 items-center truncate border border-border bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground"
    >
      {content}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActivityTimeline({
  entries,
  locale,
  currency = "PHP",
  className,
}: ActivityTimelineProps) {
  const tHistory = useTranslations("app.bookings.detail.history");
  const tFields = useTranslations("app.bookings.detail.fields");
  const tSections = useTranslations("app.bookings.detail.sections");
  const tStatus = useTranslations("app.bookings.statusValues");
  const tEventTypes = useTranslations("app.bookings.eventTypes");

  // Capture "now" once at mount so it's not called during every render pass.
  const [nowRef] = useState(() => new Date());

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (entries.length === 0) {
    return (
      <p className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
        {tFields("activityEmpty")}
      </p>
    );
  }

  // ── Group entries by LOCAL calendar day ─────────────────────────────────────
  // localIsoDate uses the browser/runtime local timezone so that grouping and
  // the per-entry toLocaleTimeString agree — no UTC-vs-local skew near midnight.
  const today = localIsoDate(nowRef);
  // Compute yesterday by subtracting 24 h then converting to local calendar day
  // (not UTC slice) to stay consistent.
  const yesterday = localIsoDate(new Date(nowRef.getTime() - 86_400_000));

  const groups: { dayKey: string; dayLabel: string; entries: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const dayKey = localIsoDate(date);
    let dayLabel: string;
    if (dayKey === today) {
      dayLabel = tHistory("today");
    } else if (dayKey === yesterday) {
      dayLabel = tHistory("yesterday");
    } else {
      dayLabel = date.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) {
      last.entries.push(entry);
    } else {
      groups.push({ dayKey, dayLabel, entries: [entry] });
    }
  }

  // ── Value formatter for diff fields ─────────────────────────────────────────
  function formatValue(key: string, raw: unknown): string {
    if (raw === null || raw === undefined || raw === "") return "—";
    const v = String(raw);
    if (key === "status") {
      // tStatus uses a safe-lookup pattern
      try {
        return tStatus(v as Parameters<typeof tStatus>[0]);
      } catch {
        return v;
      }
    }
    if (key === "eventType") {
      try {
        return tEventTypes(v as Parameters<typeof tEventTypes>[0]);
      } catch {
        return v;
      }
    }
    if (key === "amount.total" || key === "amount.deposit") {
      const n = Number(raw);
      return Number.isFinite(n) ? formatMoney(n, currency, locale) : v;
    }
    return v;
  }

  return (
    <ol className={cn("flex flex-col", className)} aria-label={tHistory("timelineLabel")}>
      {groups.map((group) => (
        <li key={group.dayKey}>
          {/* Day header */}
          <div className="sticky top-0 z-10 flex items-center gap-2 bg-background py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.dayLabel}
            </span>
            <span className="flex-1 border-t border-border" aria-hidden />
          </div>

          {/* Entries for this day */}
          <ol className="flex flex-col">
            {group.entries.map((entry, entryIdx) => {
              const isLast =
                entryIdx === group.entries.length - 1;
              const style = getActionStyle(entry.action);
              const time = new Date(entry.createdAt).toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              });

              let actionLabel: string;
              try {
                actionLabel = tHistory(
                  `actions.${entry.action}` as Parameters<typeof tHistory>[0]
                );
              } catch {
                actionLabel = entry.action.replace(/_/g, " ");
              }

              return (
                <li
                  key={entry._id}
                  className="flex min-w-0 gap-3 pb-3"
                >
                  {/* Rail: dot + connecting line */}
                  <div
                    className="flex shrink-0 flex-col items-center"
                    aria-hidden
                  >
                    <span
                      className={cn(
                        "mt-1 size-2 shrink-0",
                        style.dot
                      )}
                    />
                    {!isLast && (
                      <span className="mt-1 w-px flex-1 bg-border" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {/* Action row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ActionPill action={entry.action} label={actionLabel} />
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {time}
                      </span>
                    </div>

                    {/* Change pills */}
                    {entry.diff?.changes && Object.keys(entry.diff.changes).length > 0 ? (
                      <ul className="flex flex-wrap gap-1">
                        {Object.entries(entry.diff.changes).map(([key, change]) => {
                          const mapping = diffKeyToI18n(key);
                          if (!mapping) return null;

                          let label: string;
                          if (mapping.ns === "sections") {
                            try {
                              label = tSections(
                                mapping.key as Parameters<typeof tSections>[0]
                              );
                            } catch {
                              label = key;
                            }
                          } else {
                            try {
                              label = tFields(
                                mapping.key as Parameters<typeof tFields>[0]
                              );
                            } catch {
                              label = key;
                            }
                          }

                          const isSessions = key === "sessions";
                          if (isSessions) {
                            return (
                              <li key={key}>
                                <ChangePill label={label} sessionsOnly />
                              </li>
                            );
                          }

                          const before = formatValue(key, change.before);
                          const after = formatValue(key, change.after);

                          return (
                            <li key={key}>
                              <ChangePill label={label} before={before} after={after} />
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
