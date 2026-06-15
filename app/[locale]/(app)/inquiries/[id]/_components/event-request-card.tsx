"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationDisplay } from "@/components/ui/location-picker";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";
import { editInquirySessionsAction } from "@/app/[locale]/(app)/inquiries/_actions";
import {
  overlappingShifts,
  toMinutes,
} from "@/app/[locale]/(app)/bookings/_components/_helpers/calendar-helpers";

export type InquirySessionView = {
  startDate: string;
  startTime: string;
  endTime: string;
};

type Props = {
  eventType: string;
  guestCount: number | null;
  location:
    | {
        label?: string | null;
        address?: string | null;
        placeId?: string | null;
        lat?: number | null;
        lng?: number | null;
      }
    | null;
  message: string;
  sessions: InquirySessionView[];
  locale: string;
  // Edit mode props
  inquiryId: string;
  draftBookingId: string | null;
  phone: string | null;
  email: string;
  status: string;
};

export function EventRequestCard({
  eventType,
  guestCount,
  location,
  message,
  sessions,
  locale,
  inquiryId,
  draftBookingId,
  phone,
  email,
  status,
}: Props) {
  const t = useTranslations("app.inquiries.detail.eventRequest");
  const ts = useTranslations("app.inquiries.detail.sessionsEditor");
  const te = useTranslations("app.inquiries.eventTypes");
  const locationLabel = location?.address || location?.label || null;
  const locked = isBookedInquiryStatus(status);

  const [editing, setEditing] = useState(false);
  const [draftSessions, setDraftSessions] = useState<InquirySessionView[]>(sessions);
  const [draftPhone, setDraftPhone] = useState(phone ?? "");
  const [conflicts, setConflicts] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventLabel = (() => {
    try {
      return te(eventType);
    } catch {
      return eventType;
    }
  })();

  function fmtSessionDate(date: string): string {
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? date
      : d.toLocaleDateString(locale, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  }

  async function checkConflictsFor(next: InquirySessionView[]) {
    const checks = next.map(async (s) => {
      try {
        const url = `/api/bookings/shifts-on-date?date=${s.startDate}${
          draftBookingId ? `&excludeId=${draftBookingId}` : ""
        }`;
        const resp = await fetch(url);
        if (!resp.ok) return false;
        const { shifts } = await resp.json();
        const aStart = toMinutes(s.startTime);
        const aEnd = toMinutes(s.endTime);
        if (aStart === null || aEnd === null) return false;
        return overlappingShifts(shifts, aStart, aEnd).length > 0;
      } catch {
        return false;
      }
    });
    setConflicts(await Promise.all(checks));
  }

  async function handleSessionChange(
    idx: number,
    field: keyof InquirySessionView,
    value: string
  ) {
    const next = draftSessions.map((s, i) =>
      i === idx ? { ...s, [field]: value } : s
    );
    setDraftSessions(next);
    await checkConflictsFor(next);
  }

  const today = new Date().toISOString().slice(0, 10);
  const hasConflict = conflicts.some(Boolean);
  const hasInvalidSession = draftSessions.some(
    (s) =>
      s.startDate < today ||
      !s.startTime ||
      !s.endTime ||
      s.endTime <= s.startTime
  );
  const canSave = !hasConflict && !hasInvalidSession && !saving;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await editInquirySessionsAction(inquiryId, {
      sessions: draftSessions,
      phone: draftPhone || undefined,
    });
    setSaving(false);
    if ("ok" in result && result.ok) {
      setEditing(false);
    } else if ("error" in result) {
      setError(result.error);
    }
  }

  function handleDiscard() {
    setDraftSessions(sessions);
    setDraftPhone(phone ?? "");
    setConflicts([]);
    setError(null);
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("eventType")}
            </span>
            <span className="text-sm">{eventLabel}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("guestCount")}
            </span>
            <span className="text-sm">
              {guestCount === null ? t("none") : guestCount}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("location")}
            </span>
            <LocationDisplay
              value={{
                address: locationLabel ?? "",
                lat: location?.lat ?? null,
                lng: location?.lng ?? null,
              }}
            />
          </div>
        </div>

        {/* Sessions section */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("sessions")}
            </span>
            {locked ? (
              <span className="text-xs text-muted-foreground">
                {status === "archived"
                  ? ts("lockedArchived")
                  : ts("lockedConverted")}
              </span>
            ) : !editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setError(null);
                }}
                className="text-xs underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:underline"
              >
                {ts("edit")}
              </button>
            ) : null}
          </div>

          {!editing ? (
            sessions.length === 0 ? (
              <span className="text-sm text-muted-foreground">{t("none")}</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {sessions.map((s, i) => (
                  <li key={i} className="text-sm tabular-nums">
                    {fmtSessionDate(s.startDate)}
                    <span className="text-muted-foreground">
                      {" · "}
                      {s.startTime}–{s.endTime}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="flex flex-col gap-3">
              {draftSessions.map((s, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1.5 border border-border p-3"
                >
                  <span className="text-xs text-muted-foreground">
                    {ts("sessionLabel", { n: i + 1 })}
                    {conflicts[i] && (
                      <span className="ml-2 text-destructive font-medium">
                        · {ts("conflictInline")}
                      </span>
                    )}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-0.5 col-span-3 sm:col-span-1">
                      <label className="text-xs text-muted-foreground">
                        {ts("dateLabel")}
                      </label>
                      <input
                        type="date"
                        value={s.startDate}
                        onChange={(e) =>
                          handleSessionChange(i, "startDate", e.target.value)
                        }
                        className="border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-xs text-muted-foreground">
                        {ts("startLabel")}
                      </label>
                      <input
                        type="time"
                        value={s.startTime}
                        onChange={(e) =>
                          handleSessionChange(i, "startTime", e.target.value)
                        }
                        className="border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-xs text-muted-foreground">
                        {ts("endLabel")}
                      </label>
                      <input
                        type="time"
                        value={s.endTime}
                        onChange={(e) =>
                          handleSessionChange(i, "endTime", e.target.value)
                        }
                        className="border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {hasConflict && (
                <p className="text-xs text-destructive">{ts("conflictBlocks")}</p>
              )}
              {hasInvalidSession && !hasConflict && (
                <p className="text-xs text-destructive">{ts("pastDate")}</p>
              )}

              {/* Phone field */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-muted-foreground">
                  {ts("phoneLabel")}
                </label>
                <input
                  type="tel"
                  value={draftPhone}
                  onChange={(e) => setDraftPhone(e.target.value)}
                  className="border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Email field (read-only) */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-muted-foreground">
                  {ts("emailReadonly")}
                </label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className="border border-border bg-muted px-2 py-1 text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>

              {error && (
                <p className="text-xs text-destructive">
                  {error === "conflict"
                    ? ts("conflictBlocks")
                    : error === "alter_only"
                    ? ts("alterOnlyError")
                    : `Error: ${error}`}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  {saving ? ts("saving") : ts("save")}
                </button>
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {ts("discard")}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("message")}
          </span>
          <p className="whitespace-pre-line text-sm">{message || t("none")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
