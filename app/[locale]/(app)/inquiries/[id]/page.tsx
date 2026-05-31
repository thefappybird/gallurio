import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getInquiryWithDraft } from "@/lib/db/queries/inquiries";
import { isValidObjectId } from "mongoose";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InquiryStatusBadge } from "../_components/inquiry-status-badge";
import { ClientInfoCard } from "./_components/client-info-card";
import { EventRequestCard, type InquirySessionView } from "./_components/event-request-card";
import { BookingDraftCard } from "./_components/booking-draft-card";
import { InquiryActions } from "./_components/inquiry-actions";

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.inquiries.detail");

  const { workspace, role } = await requireOrg();

  if (!isValidObjectId(id)) notFound();

  const result = await getInquiryWithDraft(workspace._id, id);
  if (!result) notFound();

  const { inquiry, booking } = result;
  const submittedAt = new Date(inquiry.createdAt as unknown as Date);
  const submittedLabel = submittedAt.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const sessions = (inquiry.sessions ?? []) as InquirySessionView[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/inquiries"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
        >
          <ArrowLeftIcon className="size-4" />
          {t("back")}
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{inquiry.name}</h1>
              <InquiryStatusBadge status={inquiry.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("submittedOn", { date: submittedLabel })}
            </p>
          </div>
          <InquiryActions inquiryId={String(inquiry._id)} status={inquiry.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ClientInfoCard
            name={inquiry.name}
            email={inquiry.email}
            phone={inquiry.phone ?? null}
            preferredContact={inquiry.preferredContact ?? "email"}
          />
          <EventRequestCard
            eventType={inquiry.eventType ?? "other"}
            guestCount={inquiry.guestCount ?? null}
            location={inquiry.location ?? null}
            message={inquiry.message ?? ""}
            sessions={sessions}
            locale={locale}
          />
        </div>

        <div className="flex flex-col gap-4">
          <BookingDraftCard
            inquiryId={String(inquiry._id)}
            isOwner={role === "owner"}
            isConverted={inquiry.status === "converted"}
            bookingMissing={booking === null}
            bookingId={booking ? String(booking._id) : null}
            currency={booking?.amount?.currency ?? workspace.currency ?? "PHP"}
            initialTotal={booking?.amount?.total ?? 0}
            initialDeposit={booking?.amount?.deposit ?? 0}
            initialNotes={booking?.notes ?? ""}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("history.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                <li className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{t("history.submitted")}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{submittedLabel}</span>
                </li>
                {inquiry.status === "converted" && (
                  <li className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{t("history.converted")}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(inquiry.updatedAt as unknown as Date).toLocaleDateString(locale, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </li>
                )}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
