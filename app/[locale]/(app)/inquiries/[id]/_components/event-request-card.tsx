"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
};

export function EventRequestCard({
  eventType,
  guestCount,
  location,
  message,
  sessions,
  locale,
}: Props) {
  const t = useTranslations("app.inquiries.detail.eventRequest");
  const te = useTranslations("app.inquiries.eventTypes");
  const locationLabel = location?.address || location?.label || null;

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
      : d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("eventType")}</span>
            <span className="text-sm">{eventLabel}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("guestCount")}</span>
            <span className="text-sm">{guestCount === null ? t("none") : guestCount}</span>
          </div>
          <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("location")}</span>
            <span className="text-sm break-words">{locationLabel || t("none")}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("sessions")}</span>
          {sessions.length === 0 ? (
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
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("message")}</span>
          <p className="whitespace-pre-line text-sm">{message || t("none")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
