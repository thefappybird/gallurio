"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { InquiryStatusBadge } from "./inquiry-status-badge";
import { ClientInfoCard } from "../[id]/_components/client-info-card";
import { EventRequestCard, type InquirySessionView } from "../[id]/_components/event-request-card";
import { BookingDraftCard } from "../[id]/_components/booking-draft-card";
import { InquiryActions } from "../[id]/_components/inquiry-actions";
import { useTranslations } from "next-intl";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";

type InquiryBookingSummary = {
  id: string | null;
  currency: string;
  total: number;
  deposit: number;
  notes: string;
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
};

export function InquiryDetailModal({
  detail,
  open,
  onClose,
}: {
  detail: InquiryDetailModalData | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("app.inquiries.detail");

  if (!detail) return null;

  const submittedLabel = new Date(detail.submittedAt).toLocaleDateString(detail.locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const isBooked = isBookedInquiryStatus(detail.status);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0"
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
          <InquiryActions inquiryId={detail.inquiryId} status={detail.status} />
        </div>

        <div className="overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <ClientInfoCard
                name={detail.name}
                email={detail.email}
                phone={detail.phone}
                preferredContact={detail.preferredContact}
              />
              <EventRequestCard
                eventType={detail.eventType}
                guestCount={detail.guestCount}
                location={detail.location}
                message={detail.message}
                sessions={detail.sessions}
                locale={detail.locale}
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
              />

              <div className="border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-base font-medium">{t("history.title")}</h3>
                </div>
                <div className="px-4 py-3">
                  <ol className="flex flex-col gap-3">
                    <li className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{t("history.submitted")}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {submittedLabel}
                      </span>
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
