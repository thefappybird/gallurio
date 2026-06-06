"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { InquiryStatusBadge } from "./inquiry-status-badge";

export type InquiryRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  eventDate: string | null; // ISO date string
  eventType: string;
  submittedAt: string; // ISO datetime string
  source: string | null;
};

type Props = {
  rows: InquiryRow[];
  locale: string;
  empty: string;
  emptyHint: string;
};

export function InquiryTable({ rows, locale, empty, emptyHint }: Props) {
  const t = useTranslations("app.inquiries");

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
      {/* Mobile: stacked cards (≥44px tap targets). */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/inquiries/${row.id}`}
              aria-label={t("table.open", { name: row.name })}
              className="flex flex-col gap-1.5 border border-border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold leading-snug">{row.name}</span>
                <InquiryStatusBadge status={row.status} />
              </div>
              <span className="truncate text-xs text-muted-foreground">{row.email}</span>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>{eventTypeLabel(row.eventType)}</span>
                <span>·</span>
                <span>{fmtDate(row.eventDate)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: table. */}
      <div className="hidden overflow-x-auto border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium">{t("table.col.status")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("table.col.client")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("table.col.eventType")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("table.col.eventDate")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("table.col.submitted")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("table.col.source")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border transition-colors last:border-b-0 hover:bg-accent/40 focus-within:bg-accent/40"
              >
                <td className="px-3 py-2.5 align-middle">
                  <InquiryStatusBadge status={row.status} />
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <Link
                    href={`/inquiries/${row.id}`}
                    aria-label={t("table.open", { name: row.name })}
                    className="flex flex-col focus-visible:outline-none focus-visible:underline"
                  >
                    <span className="font-semibold leading-snug">{row.name}</span>
                    <span className="text-xs text-muted-foreground">{row.email}</span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 align-middle">{eventTypeLabel(row.eventType)}</td>
                <td className="px-3 py-2.5 align-middle">{fmtDate(row.eventDate)}</td>
                <td className="px-3 py-2.5 align-middle text-muted-foreground">
                  {fmtDateTime(row.submittedAt)}
                </td>
                <td className="px-3 py-2.5 align-middle text-muted-foreground">
                  {row.source ?? t("table.directSource")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
