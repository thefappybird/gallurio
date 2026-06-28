"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import type { ActivityLogDoc } from "@/lib/db/models";
import { PagedList } from "./paged-list";

type Props = {
  activity: ActivityLogDoc[];
  locale: string;
  title: string;
  empty: string;
};

function formatRelative(date: Date, locale: string) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function ActivityFeed({ activity, locale, title, empty }: Props) {
  const t = useTranslations("app.dashboard");

  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <InfoHint label={t("hints.activity")} />
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <PagedList
            items={activity.map((a) => (
              <li
                key={String(a._id)}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <span className="capitalize text-foreground">
                  {t(`activityEntity.${a.entity}`)} {t(`activityAction.${a.action}`)}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatRelative(new Date(a.createdAt as unknown as Date), locale)}
                </span>
              </li>
            ))}
          />
        )}
      </CardContent>
    </Card>
  );
}
