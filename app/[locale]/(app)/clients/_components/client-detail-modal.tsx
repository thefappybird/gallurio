"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getClientBookingsAction } from "@/lib/actions/clients";
import type { ClientBookingRow } from "@/app/[locale]/(app)/clients/_data/clients-queries";
import type { BookingStatus } from "@/lib/validators/booking";
import type { ClientRow } from "./clients-table";
import { SourceBadge } from "./source-badge";

type Props = {
  client: ClientRow | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (client: ClientRow) => void;
  onDeactivate?: (client: ClientRow) => void;
  onReactivate?: (client: ClientRow) => void;
  /** Id of the client currently being reactivated — mirrors the table row's pending state. */
  reactivatingId?: string | null;
  locale: string;
};

export function ClientDetailModal({
  client,
  open,
  onClose,
  onEdit,
  onDeactivate,
  onReactivate,
  reactivatingId = null,
  locale,
}: Props) {
  if (!client) return null;
  return (
    <ClientDetailModalInner
      key={`${client.id}:${open ? "open" : "closed"}`}
      client={client}
      open={open}
      onClose={onClose}
      onEdit={onEdit}
      onDeactivate={onDeactivate}
      onReactivate={onReactivate}
      reactivatingId={reactivatingId}
      locale={locale}
    />
  );
}

type InnerProps = Omit<Props, "client"> & { client: ClientRow };

function ClientDetailModalInner({
  client,
  open,
  onClose,
  onEdit,
  onDeactivate,
  onReactivate,
  reactivatingId = null,
  locale,
}: InnerProps) {
  const t = useTranslations("app.clients");
  const tBookingStatus = useTranslations("app.bookings.statusValues");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [bookings, setBookings] = useState<ClientBookingRow[] | null>(null);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  // Lazy-load bookings on first activation of the bookings tab. The outer
  // component re-keys this inner component on client.id and open, so all
  // local state resets naturally when those change — no reset effect needed.
  useEffect(() => {
    if (!open || activeTab !== "bookings") return;
    if (bookings !== null || bookingsError) return;

    let cancelled = false;
    getClientBookingsAction(client.id).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setBookingsError(result.error);
      } else {
        setBookings(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, activeTab, client.id, bookings, bookingsError]);

  // Loading is derived: the bookings tab is loading whenever we're on it for
  // this client and we haven't resolved into either bookings or an error yet.
  const bookingsLoading =
    activeTab === "bookings" && bookings === null && bookingsError === null;

  const lastBookingDate = client.lastBookingAt
    ? new Date(client.lastBookingAt).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {/* Cap modal height to the small viewport so long notes / 50-row
          booking lists scroll inside the tab panels instead of pushing the
          header and footer past the screen edge on mobile. */}
      <DialogContent showCloseButton={false} className="flex max-h-[calc(100dvh-2rem)] sm:max-w-lg flex-col gap-0 p-0">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <DialogTitle className="truncate leading-snug">{client.name}</DialogTitle>
              {!client.isActive && (
                <span className="shrink-0 text-xs text-muted-foreground">{t("detail.inactive")}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <SourceBadge source={client.source} />
              {client.email && (
                <span className="min-w-0 wrap-break-word">{client.email}</span>
              )}
              {client.phone && <span className="wrap-break-word">{client.phone}</span>}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label={t("detail.close")}
            className="shrink-0 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="px-4">
            <TabsTab value="overview">{t("detail.tabs.overview")}</TabsTab>
            <TabsTab value="bookings">{t("detail.tabs.bookings")}</TabsTab>
            <TabsTab value="payments">{t("detail.tabs.payments")}</TabsTab>
          </TabsList>

          {/* Overview Tab */}
          <TabsPanel value="overview" className="overflow-y-auto px-4 py-4">
            {/* Stats grid */}
            <div className="mb-4 grid grid-cols-1 divide-y divide-border border border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="flex flex-col items-center py-3 text-center">
                <span className="text-lg font-semibold tabular-nums text-brand">
                  {new Intl.NumberFormat(locale, {
                    style: "currency",
                    currency: client.currency,
                    minimumFractionDigits: 0,
                  }).format(client.totalSpent)}
                </span>
                <span className="text-xs text-muted-foreground">{t("detail.overview.totalSpent")}</span>
              </div>
              <div className="flex flex-col items-center py-3 text-center">
                <span className="text-lg font-semibold">{client.bookingsCount}</span>
                <span className="text-xs text-muted-foreground">{t("detail.overview.bookingsCount")}</span>
              </div>
              <div className="flex flex-col items-center py-3 text-center">
                <span className="text-lg font-semibold">
                  {lastBookingDate ?? t("detail.overview.never")}
                </span>
                <span className="text-xs text-muted-foreground">{t("detail.overview.lastBooking")}</span>
              </div>
            </div>

            {/* Tags */}
            <div className="mb-3 flex flex-col gap-1 border-b border-border pb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.overview.tags")}
              </span>
              {client.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {client.tags.map((tag) => (
                    <span
                      key={tag}
                      className="max-w-full wrap-break-word border border-border bg-muted px-1.5 py-0.5 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">{t("detail.overview.noTags")}</span>
              )}
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.overview.notes")}
              </span>
              <p className="whitespace-pre-wrap wrap-break-word text-sm">
                {client.notes || <span className="text-muted-foreground">{t("detail.overview.noNotes")}</span>}
              </p>
            </div>
          </TabsPanel>

          {/* Bookings Tab */}
          <TabsPanel value="bookings" className="overflow-y-auto px-4 py-4">
            {bookingsLoading && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
            {bookingsError && (
              <p className="text-sm text-destructive">{t("detail.bookings.error")}</p>
            )}
            {!bookingsLoading && !bookingsError && bookings !== null && (
              bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("detail.bookings.empty")}</p>
              ) : (
                <div className="flex flex-col divide-y divide-border border border-border">
                  {bookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{b.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(b.firstSessionStart).toLocaleDateString(locale, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {tBookingStatus(b.status as BookingStatus)}
                        </Badge>
                        <span className="text-sm tabular-nums">
                          {new Intl.NumberFormat(locale, {
                            style: "currency",
                            currency: b.currency,
                            minimumFractionDigits: 0,
                          }).format(b.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </TabsPanel>

          {/* Payments Tab */}
          <TabsPanel value="payments" className="overflow-y-auto px-4 py-4">
            <p className="text-sm text-muted-foreground">{t("detail.payments.empty")}</p>
          </TabsPanel>
        </Tabs>

        {/* Footer — hidden entirely when no action handlers are provided (read-only embedded view) */}
        {(onEdit || (client.isActive ? onDeactivate : onReactivate)) ? (
          <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
            {client.isActive && onDeactivate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 border-destructive text-destructive hover:bg-destructive/10 sm:min-h-0"
                onClick={() => onDeactivate(client)}
              >
                {t("detail.deactivate")}
              </Button>
            ) : !client.isActive && onReactivate ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="min-h-11 sm:min-h-0"
                loading={reactivatingId === client.id}
                onClick={() => onReactivate(client)}
              >
                {t("detail.reactivate")}
              </Button>
            ) : (
              <span />
            )}
            {onEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(client)}
                className="min-h-11 sm:min-h-0"
              >
                {t("detail.edit")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
