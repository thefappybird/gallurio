"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { AlertTriangleIcon, EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InquiryStatusBadge } from "./inquiry-status-badge";
import { buildInquiryModalPath } from "@/lib/inquiries/links";
import { cn } from "@/lib/utils";

export type InquiryRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  eventTitle: string | null;
  eventDate: string | null;
  eventType: string;
  submittedAt: string;
  source: string | null;
  hasConflict?: boolean;
};

type Props = {
  rows: InquiryRow[];
  locale: string;
  empty: string;
  emptyHint: string;
};

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

export function InquiryTable({ rows, locale, empty, emptyHint }: Props) {
  const t = useTranslations("app.inquiries");
  const router = useRouter();

  function eventTypeLabel(type: string): string {
    try {
      return t(`eventTypes.${type}`);
    } catch {
      return type;
    }
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return t("table.noDate");
    return new Date(iso).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function fmtDateTime(iso: string): string {
    return new Date(iso).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function openInquiry(id: string) {
    router.push(buildInquiryModalPath(id));
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 border border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm font-medium">{empty}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
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
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-start text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium text-start">
                {t("table.col.status")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-start">
                {t("table.col.client")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-start">
                {t("table.col.eventTitle")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-start">
                {t("table.col.eventType")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-start">
                {t("table.col.eventDate")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-start">
                {t("table.col.submitted")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-start">
                {t("table.col.source")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-start">
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
                onClick={() => openInquiry(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openInquiry(row.id);
                  }
                }}
              >
                <td className="px-3 py-2.5 align-middle">
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
                <td className="px-3 py-2.5 align-middle">
                  <span className="flex flex-col">
                    <span className="font-semibold leading-snug">
                      {row.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {row.email}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5 align-middle">
                  {row.eventTitle ?? t("table.noTitle")}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  {eventTypeLabel(row.eventType)}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  {fmtDate(row.eventDate)}
                </td>
                <td className="px-3 py-2.5 align-middle text-muted-foreground">
                  {fmtDateTime(row.submittedAt)}
                </td>
                <td className="px-3 py-2.5 align-middle capitalize text-muted-foreground">
                  {row.source ?? t("table.directSource")}
                </td>
                <td
                  className="px-3 py-2.5 align-middle"
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
