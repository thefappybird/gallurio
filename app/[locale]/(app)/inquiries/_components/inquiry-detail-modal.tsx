"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { InquiryStatusBadge } from "./inquiry-status-badge";
import { ClientInfoCard } from "../[id]/_components/client-info-card";
import { EventRequestCard, type InquirySessionView } from "../[id]/_components/event-request-card";
import { BookingDraftCard } from "../[id]/_components/booking-draft-card";
import { InquiryActions } from "../[id]/_components/inquiry-actions";
import { useTranslations } from "next-intl";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";
import type { BookingTeamOption } from "../../bookings/_data/team-options";
import type { InquiryOptimisticPatch } from "@/lib/inquiries/optimistic-patch";

type InquiryBookingSummary = {
  id: string | null;
  currency: string;
  total: number;
  deposit: number;
  notes: string;
  teamId?: string | null;
};

export type InquiryDetailModalData = {
  inquiryId: string;
  locale: string;
  name: string;
  email: string;
  phone: string | null;
  preferredContact: string;
  status: string;
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
  sessions: InquirySessionView[];
  submittedAt: string;
  updatedAt: string;
  bookingMissing: boolean;
  booking: InquiryBookingSummary | null;
  isOwner: boolean;
  hasConflict?: boolean;
  /** When true the modal is display-only: actions are hidden and cards are non-editable. */
  readOnly?: boolean;
};

export function InquiryDetailModal({
  detail,
  open,
  onClose,
  teams = [],
  onConverted,
  onInquiryChanged,
}: {
  detail: InquiryDetailModalData | null;
  open: boolean;
  onClose: () => void;
  teams?: BookingTeamOption[];
  onConverted?: () => void;
  onInquiryChanged?: (inquiryId: string, patch: InquiryOptimisticPatch) => void;
}) {
  const t = useTranslations("app.inquiries.detail");
  const [detailId, setDetailId] = useState(detail?.inquiryId);
  const [clientResolutionRequest, setClientResolutionRequest] = useState(0);
  if (detail?.inquiryId !== detailId) {
    setDetailId(detail?.inquiryId);
    setClientResolutionRequest(0);
  }

  if (!detail) return null;

  const readOnly = detail.readOnly ?? false;
  const submittedLabel = new Date(detail.submittedAt).toLocaleDateString(detail.locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const isBooked = isBookedInquiryStatus(detail.status);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="flex w-full max-h-[calc(100dvh-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <DialogTitle className="truncate text-xl font-semibold leading-snug">
                {detail.name}
              </DialogTitle>
              <InquiryStatusBadge status={detail.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("submittedOn", { date: submittedLabel })}
            </p>
          </div>
          {!readOnly && <InquiryActions inquiryId={detail.inquiryId} status={detail.status} />}
        </div>

        {detail.hasConflict && (
          <div className="shrink-0 border-b border-border px-4 py-2">
            <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t("conflictBanner")}
            </div>
          </div>
        )}

        <div className="overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <ClientInfoCard
                inquiryId={detail.inquiryId}
                name={detail.name}
                email={detail.email}
                phone={detail.phone}
                preferredContact={detail.preferredContact}
                status={detail.status}
                readOnly={readOnly}
                message={detail.message}
                clientResolutionRequest={clientResolutionRequest}
                onInquiryChanged={readOnly ? undefined : onInquiryChanged}
              />
              <EventRequestCard
                eventType={detail.eventType}
                guestCount={detail.guestCount}
                location={detail.location}
                message={detail.message}
              />
            </div>

            <div className="flex flex-col gap-4">
              <BookingDraftCard
                inquiryId={detail.inquiryId}
                isOwner={detail.isOwner}
                isConverted={isBooked}
                bookingMissing={detail.bookingMissing}
                bookingId={detail.booking?.id ?? null}
                currency={detail.booking?.currency ?? "PHP"}
                initialTotal={detail.booking?.total ?? 0}
                initialDeposit={detail.booking?.deposit ?? 0}
                initialNotes={detail.booking?.notes ?? ""}
                teams={teams}
                initialTeamId={detail.booking?.teamId ?? null}
                sessions={detail.sessions}
                locale={detail.locale}
                hasConflict={detail.hasConflict}
                readOnly={readOnly}
                onConverted={readOnly ? undefined : onConverted}
                onClientResolutionRequired={() => setClientResolutionRequest((request) => request + 1)}
                onInquiryChanged={readOnly ? undefined : onInquiryChanged}
              />

              <div className="border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-base font-medium">{t("history.title")}</h3>
                </div>
                <div className="px-4 py-3">
                  <ol className="flex flex-col gap-3">
                    <li className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{t("history.submitted")}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{submittedLabel}</span>
                    </li>
                    {isBooked ? (
                      <li className="flex items-baseline justify-between gap-3 text-sm">
                        <span>{t("history.booked")}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(detail.updatedAt).toLocaleDateString(detail.locale, {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </li>
                    ) : null}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
