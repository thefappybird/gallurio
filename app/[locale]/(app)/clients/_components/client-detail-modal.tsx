"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { XIcon } from "lucide-react";
import { getClientBookingsAction } from "@/lib/actions/clients";
import type { ClientBookingRow } from "@/app/[locale]/(app)/clients/_data/clients-queries";
import type { ClientRow } from "./clients-table";

type Props = {
  client: ClientRow | null;
  open: boolean;
  onClose: () => void;
  onEdit: (client: ClientRow) => void;
  onDeactivate: (client: ClientRow) => void;
  locale: string;
};

// Fake minimal transaction shape for the Payments tab
type TransactionRow = {
  id: string;
  date: Date | string;
  type: string;
  amount: number;
  currency: string;
  bookingRef?: string;
};

const SOURCE_BADGE_CLASS: Record<string, string> = {
  form: "border-brand text-brand",
  manual: "border-muted-foreground text-muted-foreground",
  referral: "border-foreground text-foreground",
  import: "border-muted-foreground text-muted-foreground",
};

export function ClientDetailModal({ client, open, onClose, onEdit, onDeactivate, locale }: Props) {
  const t = useTranslations("app.clients");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [bookings, setBookings] = useState<ClientBookingRow[] | null>(null);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  // Reset tab when modal closes/opens
  useEffect(() => {
    if (!open) {
      setActiveTab("overview");
      setBookings(null);
      setBookingsError(null);
    }
  }, [open]);

  // Lazy-load bookings on first tab activation
  useEffect(() => {
    if (activeTab !== "bookings" || !client || bookings !== null || bookingsLoading) return;
    setBookingsLoading(true);
    getClientBookingsAction(client.id).then((result) => {
      if ("error" in result) {
        setBookingsError(result.error);
      } else {
        setBookings(result);
      }
      setBookingsLoading(false);
    });
  }, [activeTab, client, bookings, bookingsLoading]);

  if (!client) return null;

  const lastBookingDate = client.lastBookingAt
    ? new Date(client.lastBookingAt).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-w-lg flex-col gap-0 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex flex-col">
            <DialogTitle className="leading-snug">{client.name}</DialogTitle>
            {!client.isActive && (
              <span className="text-xs text-muted-foreground">Inactive</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label={t("detail.close")}
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
            <div className="mb-4 grid grid-cols-3 divide-x divide-border border border-border">
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

            {/* Contact */}
            <div className="mb-3 flex flex-col gap-1 border-b border-border pb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.overview.contact")}
              </span>
              <div className="flex flex-col gap-0.5 text-sm">
                <span>{client.email ?? t("detail.overview.noEmail")}</span>
                <span className="text-muted-foreground">{client.phone ?? t("detail.overview.noPhone")}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={SOURCE_BADGE_CLASS[client.source] ?? ""}
                >
                  {t(`sourceValues.${client.source}` as Parameters<typeof t>[0])}
                </Badge>
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
                      className="border border-border bg-muted px-1.5 py-0.5 text-xs"
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
              <p className="whitespace-pre-wrap text-sm">
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
                    <div key={b.id} className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{b.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(b.firstSessionStart).toLocaleDateString(locale, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {b.status}
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

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <Button
            type="button"
            variant={client.isActive ? "outline" : "default"}
            size="sm"
            className={client.isActive ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
            onClick={() => onDeactivate(client)}
          >
            {client.isActive ? t("detail.deactivate") : t("detail.reactivate")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(client)}
          >
            {t("detail.edit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
