"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationDisplay } from "@/components/ui/location-picker";

const LocationMap = dynamic(() => import("@/components/ui/location-map"), {
  ssr: false,
  loading: () => <div className="h-40 w-full animate-pulse bg-muted" aria-hidden />,
});

export type InquirySessionView = {
  startDate: string;
  startTime: string;
  endTime: string;
};

type Props = {
  eventType: string;
  guestCount: number | null;
  location: {
    label?: string | null;
    address?: string | null;
    placeId?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  message: string;
};

export function EventRequestCard({ eventType, guestCount, location, message }: Props) {
  const t = useTranslations("app.inquiries.detail.eventRequest");
  const te = useTranslations("app.inquiries.eventTypes");
  const locationLabel = location?.address || location?.label || null;

  const eventLabel = (() => {
    try { return te(eventType); } catch { return eventType; }
  })();

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
            <span className="text-sm">{guestCount === null ? t("none") : guestCount}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("location")}
          </span>
          <LocationDisplay
            value={{ address: locationLabel ?? "", lat: location?.lat ?? null, lng: location?.lng ?? null }}
          />
          {location?.lat != null && location?.lng != null ? (
            <div className="overflow-hidden border border-border">
              <LocationMap
                lat={location.lat}
                lng={location.lng}
                onPick={() => {}}
                disabled
                compact
                scrollWheelZoom
              />
            </div>
          ) : null}
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
