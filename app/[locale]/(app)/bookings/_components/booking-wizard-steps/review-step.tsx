"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils";
import { CollapsibleDrawer } from "@/components/ui/collapsible-drawer";
import type { WizardValues, WizardSession } from "./types";

type Props = {
  values: WizardValues;
  locale: string;
  /** Teams the booking could be assigned to — used to show the team name in the
   *  summary even when no team picker was shown (single writable team). */
  teams?: { id: string; name: string }[];
};

export function ReviewStep({ values, locale, teams }: Props) {
  const t = useTranslations("app.bookings.wizard.review");
  const tWiz = useTranslations("app.bookings.wizard");
  const tFields = useTranslations("app.bookings.detail.fields");
  const tSessions = useTranslations("app.bookings.sessions");
  const tPayments = useTranslations("app.bookings.payments");

  const clientLabel =
    values.client.mode === "existing"
      ? values.client.clientName
      : values.client.name;

  const teamName = values.teamId
    ? (teams?.find((tm) => tm.id === values.teamId)?.name ?? null)
    : null;

  const summaryRows: Array<[string, string]> = [
    [tFields("title"), values.title || "—"],
    [tFields("clientName"), clientLabel || "—"],
    [tFields("eventType"), values.eventType],
    [tWiz("teamLabel"), teamName ?? "—"],
    [tFields("location"), values.location?.address || "—"],
    [
      tFields("total"),
      formatMoney(values.amount.total ?? 0, values.amount.currency, locale),
    ],
    [
      tFields("deposit"),
      formatMoney(values.amount.deposit ?? 0, values.amount.currency, locale),
    ],
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {summaryRows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 border-b border-border pb-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="truncate text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Sessions list */}
      <CollapsibleDrawer
        title={
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tSessions("reviewLabel")} ({(values.sessions ?? []).length})
          </span>
        }
        defaultOpen
        bodyClassName="max-h-64 overflow-y-auto scrollbar-subtle"
      >
        <ul className="flex flex-col gap-1.5">
          {(values.sessions ?? []).map((s, i) => (
            <li key={i} className="border border-border px-3 py-2 text-sm">
              <span className="font-medium">{tSessions("label", { n: i + 1 })}</span>
              <span className="ms-2 text-muted-foreground">
                {formatSessionRange(s, locale)}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleDrawer>

      {/* Payments list */}
      {(values.payments ?? []).length > 0 ? (
        <CollapsibleDrawer
          title={
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tPayments("reviewLabel")} ({values.payments.length})
            </span>
          }
          defaultOpen
          bodyClassName="max-h-64 overflow-y-auto scrollbar-subtle"
        >
          <ul className="flex flex-col gap-1.5">
            {values.payments.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{tPayments("label", { n: i + 1 })}</span>
                <span className="flex items-center gap-2">
                  <span>{formatMoney(p.price, values.amount.currency, locale)}</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs",
                      p.status === "paid"
                        ? "bg-brand/10 text-brand"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {tPayments(p.status)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </CollapsibleDrawer>
      ) : null}
    </div>
  );
}

function formatSessionRange(s: WizardSession, locale: string): string {
  if (!s.startDate) return "—";
  const datePart = formatDate(s.startDate, locale);
  const timePart =
    s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : s.startTime || "";
  return timePart ? `${datePart} · ${timePart}` : datePart;
}

function formatDate(date: string, locale: string): string {
  if (!date) return "—";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
