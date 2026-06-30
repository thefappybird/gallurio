"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import type { SerializedActivity } from "../_data/dashboard-metrics";
import { PagedList } from "./paged-list";
import { formatRelativeTime } from "@/lib/i18n/relativeTime";

type Props = {
  activity: SerializedActivity[];
  locale: string;
  title: string;
  empty: string;
};

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
                key={a._id}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <span className="capitalize text-foreground">
                  {t(`activityEntity.${a.entity}`)} {t(`activityAction.${a.action}`)}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatRelativeTime(a.createdAt, locale)}
                </span>
              </li>
            ))}
          />
        )}
      </CardContent>
    </Card>
  );
}
