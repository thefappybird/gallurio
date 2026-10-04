"use client";

import { useCallback, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { AlertTriangleIcon, EyeIcon, InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InquiryStatusBadge } from "./inquiry-status-badge";
import { preloadInquiryDetailModal } from "./inquiry-detail-dynamic";
import { EmptyState } from "@/components/app/empty-state";
import { buildInquiryModalPath } from "@/lib/inquiries/links";
import { cn } from "@/lib/utils";
import { FALLBACK_TZ } from "@/lib/utils/timezone";
import type { SortDir } from "@/lib/tables/sort";
import { nextSortDir } from "@/lib/tables/sort-next";
import { ariaSortFor, SortHeaderButton } from "@/components/app/table-sort";

// Desktop columns in render order; `key` is the server sort key (null = unsortable).
const COLUMNS = [
  { col: "status", key: "status" },
  { col: "client", key: "client" },
  { col: "eventTitle", key: "eventTitle" },
  { col: "eventType", key: "eventType" },
  { col: "eventDate", key: "eventDate" },
  { col: "submitted", key: "submitted" },
  { col: "booked", key: "bookedAt" },
  { col: "source", key: "source" },
] as const;

export type InquiryRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  eventTitle: string | null;
  eventDate: string | null;
  eventType: string;
  submittedAt: string;
  /** ISO string; null when never booked or predates bookedAt. */
  bookedAt: string | null;
  source: string | null;
  hasConflict?: boolean;
};

type Props = {
  rows: InquiryRow[];
  locale: string;
  empty: string;
  emptyHint: string;
  /** Workspace IANA timezone; dates are instants and must render in it. */
  workspaceTz?: string;
  /** Lets the page own URL navigation so opening a row shares the same
   * transition as filters and pagination. */
  onOpenInquiry?: (inquiryId: string) => void;
  /** Server sort state (URL `sort` / `dir`). */
  sortKey?: string;
  sortDir?: SortDir;
  /** Fires with the next sort when a header is clicked. */
  onSortChange?: (key: string, dir: SortDir) => void;
};

// One Intl.DateTimeFormat per locale|tz, built once (construction is expensive).
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(locale: string, tz: string): Intl.DateTimeFormat {
  const key = `${locale}|${tz}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

function CardField({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-sm text-foreground", valueClassName)}>{value}</dd>
    </div>
  );
}

export function InquiryTable({ rows, locale, empty, emptyHint, workspaceTz = FALLBACK_TZ, onOpenInquiry, sortKey = "submitted", sortDir = "desc", onSortChange }: Props) {
  const t = useTranslations("app.inquiries");
  const router = useRouter();

  const dateFormatter = getDateFormatter(locale, workspaceTz);

  function eventTypeLabel(type: string): string {
    try {
      return t(`eventTypes.${type}`);
    } catch {
      return type;
    }
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return t("table.noDate");
    return dateFormatter.format(new Date(iso));
  }

  // Submitted timestamps render date-only, same as event dates.
  const fmtDateTime = (iso: string): string =>
    dateFormatter.format(new Date(iso));

  const openInquiry = useCallback(
    (id: string) => {
      if (onOpenInquiry) {
        onOpenInquiry(id);
        return;
      }
      router.push(buildInquiryModalPath(id));
    },
    [onOpenInquiry, router]
  );

  if (rows.length === 0) {
    return <EmptyState icon={InboxIcon} title={empty} description={emptyHint} />;
  }

  return (
    <>
      <div
        data-testid="inquiries-card-list"
        className="flex flex-col gap-3 lg:hidden"
      >
        {rows.map((row) => {
          function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openInquiry(row.id);
            }
          }

          return (
            <article
              key={row.id}
              role="button"
              tabIndex={0}
              aria-label={t("table.open", { name: row.name })}
              onPointerEnter={preloadInquiryDetailModal}
              onFocus={preloadInquiryDetailModal}
              onClick={() => openInquiry(row.id)}
              onKeyDown={handleKeyDown}
              className="border border-border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <InquiryStatusBadge status={row.status} />
                    <span className="inline-flex items-center border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {eventTypeLabel(row.eventType)}
                    </span>
                    {row.hasConflict ? (
                      <span className="inline-flex items-center gap-0.5 border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                        <AlertTriangleIcon className="size-3" />
                        {t("table.conflict")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold leading-snug">{row.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.email}
                  </p>
                </div>

                <div onClick={(event) => event.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("table.actions.view")}
                    onClick={() => openInquiry(row.id)}
                  >
                    <EyeIcon className="size-4" />
                  </Button>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <CardField
                  label={t("table.col.eventTitle")}
                  value={row.eventTitle ?? t("table.noTitle")}
                />
                <CardField
                  label={t("table.col.eventDate")}
                  value={fmtDate(row.eventDate)}
                />
                <CardField
                  label={t("table.col.booked")}
                  value={row.bookedAt ? fmtDateTime(row.bookedAt) : "—"}
                />
                <CardField
                  label={t("table.col.submitted")}
                  value={
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span>{fmtDateTime(row.submittedAt)}</span>
                      <span aria-hidden>-</span>
                      <span className="capitalize">
                        {row.source ?? t("table.directSource")}
                      </span>
                    </span>
                  }
                  valueClassName="capitalize text-muted-foreground"
                />
              </dl>
            </article>
          );
        })}
      </div>

      <div className="hidden min-w-0 max-w-full overflow-x-auto border border-border bg-card lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-start text-xs uppercase tracking-wide text-muted-foreground">
              {COLUMNS.map(({ col, key }) => {
                const sorted = sortKey === key && sortDir;
                return (
                  <th
                    key={col}
                    scope="col"
                    aria-sort={ariaSortFor(sorted)}
                    className="px-2 py-2 font-medium xl:px-3 text-start"
                  >
                    <SortHeaderButton
                      label={t(`table.col.${col}`)}
                      sorted={sorted}
                      onClick={() =>
                        onSortChange?.(
                          key,
                          nextSortDir("inquiries", sortKey, sortDir, key)
                        )
                      }
                    />
                  </th>
                );
              })}
              <th scope="col" className="px-2 py-2 font-medium xl:px-3 text-start">
                <span className="sr-only">{t("table.col.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                aria-label={t("table.open", { name: row.name })}
                className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                onPointerEnter={preloadInquiryDetailModal}
                onFocus={preloadInquiryDetailModal}
                onClick={() => openInquiry(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openInquiry(row.id);
                  }
                }}
              >
                <td className="px-2 py-2.5 align-middle xl:px-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <InquiryStatusBadge status={row.status} />
                    {row.hasConflict ? (
                      <span className="inline-flex items-center gap-0.5 border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                        <AlertTriangleIcon className="size-3" />
                        {t("table.conflict")}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-2.5 align-middle xl:px-3">
                  <span className="flex flex-col">
                    <span
                      className="block max-w-[12rem] truncate font-semibold leading-snug"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                    <span
                      className="block max-w-[12rem] truncate text-xs text-muted-foreground"
                      title={row.email}
                    >
                      {row.email}
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2.5 align-middle xl:px-3">
                  <span
                    className="block max-w-[10rem] truncate"
                    title={row.eventTitle ?? undefined}
                  >
                    {row.eventTitle ?? t("table.noTitle")}
                  </span>
                </td>
                <td className="px-2 py-2.5 align-middle xl:px-3">
                  {eventTypeLabel(row.eventType)}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 align-middle xl:px-3">
                  {fmtDate(row.eventDate)}
                </td>
                <td className="px-2 py-2.5 align-middle xl:px-3 whitespace-nowrap text-muted-foreground">
                  {fmtDateTime(row.submittedAt)}
                </td>
                <td className="px-2 py-2.5 align-middle xl:px-3 whitespace-nowrap text-muted-foreground">
                  {row.bookedAt ? fmtDateTime(row.bookedAt) : "—"}
                </td>
                <td className="px-2 py-2.5 align-middle xl:px-3 capitalize text-muted-foreground">
                  <span
                    className="block max-w-[6rem] truncate"
                    title={row.source ?? undefined}
                  >
                    {row.source ?? t("table.directSource")}
                  </span>
                </td>
                <td
                  className="px-2 py-2.5 align-middle xl:px-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("table.actions.view")}
                      onClick={() => openInquiry(row.id)}
                    >
                      <EyeIcon className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
