"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InquiryStatusBadge } from "./inquiry-status-badge";
import { buildInquiryModalPath } from "@/lib/inquiries/links";

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
      {/* Mobile cards */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={buildInquiryModalPath(row.id)}
              aria-label={t("table.open", { name: row.name })}
              className="flex flex-col gap-1.5 border border-border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold leading-snug">{row.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <InquiryStatusBadge status={row.status} />
                  {row.hasConflict && (
                    <span className="inline-flex items-center gap-0.5 border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                      ⚠ {t("table.conflict")}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("table.actions.view")}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(buildInquiryModalPath(row.id));
                    }}
                  >
                    <EyeIcon className="size-4" />
                  </Button>
                </div>
              </div>
              <span className="truncate text-xs text-muted-foreground">{row.email}</span>
              {row.eventTitle ? <span className="text-xs">{row.eventTitle}</span> : null}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>{eventTypeLabel(row.eventType)}</span>
                <span>·</span>
                <span>{fmtDate(row.eventDate)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-start text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium text-start">{t("table.col.status")}</th>
              <th scope="col" className="px-3 py-2 font-medium text-start">{t("table.col.client")}</th>
              <th scope="col" className="px-3 py-2 font-medium text-start">{t("table.col.eventTitle")}</th>
              <th scope="col" className="px-3 py-2 font-medium text-start">{t("table.col.eventType")}</th>
              <th scope="col" className="px-3 py-2 font-medium text-start">{t("table.col.eventDate")}</th>
              <th scope="col" className="px-3 py-2 font-medium text-start">{t("table.col.submitted")}</th>
              <th scope="col" className="px-3 py-2 font-medium text-start">{t("table.col.source")}</th>
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
                onClick={() => router.push(buildInquiryModalPath(row.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(buildInquiryModalPath(row.id));
                  }
                }}
              >
                <td className="px-3 py-2.5 align-middle">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <InquiryStatusBadge status={row.status} />
                    {row.hasConflict && (
                      <span className="inline-flex items-center gap-0.5 border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                        ⚠ {t("table.conflict")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <span className="flex flex-col">
                    <span className="font-semibold leading-snug">{row.name}</span>
                    <span className="text-xs text-muted-foreground">{row.email}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 align-middle">{row.eventTitle ?? t("table.noTitle")}</td>
                <td className="px-3 py-2.5 align-middle">{eventTypeLabel(row.eventType)}</td>
                <td className="px-3 py-2.5 align-middle">{fmtDate(row.eventDate)}</td>
                <td className="px-3 py-2.5 align-middle text-muted-foreground">{fmtDateTime(row.submittedAt)}</td>
                <td className="px-3 py-2.5 align-middle capitalize text-muted-foreground">
                  {row.source ?? t("table.directSource")}
                </td>
                <td
                  className="px-3 py-2.5 align-middle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("table.actions.view")}
                      onClick={() => router.push(buildInquiryModalPath(row.id))}
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
