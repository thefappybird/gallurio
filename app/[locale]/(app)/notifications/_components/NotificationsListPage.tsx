"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, MessageSquare, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/[locale]/(app)/notifications/_actions";
import {
  loadMoreNotificationsAction,
  type SerializedNotification,
} from "@/app/[locale]/(app)/notifications/_load-more-action";
import { formatRelativeTime } from "@/lib/i18n/relativeTime";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { useNotificationBurstToast } from "@/lib/hooks/useNotificationBurstToast";

function notificationIcon(type: string) {
  if (type.startsWith("inquiry")) return <MessageSquare className="size-4 shrink-0" />;
  if (type.startsWith("booking")) return <Calendar className="size-4 shrink-0" />;
  if (type.startsWith("team")) return <Users className="size-4 shrink-0" />;
  return <Bell className="size-4 shrink-0" />;
}

interface Props {
  initialItems: SerializedNotification[];
  initialNextCursor: string | null;
  locale: string;
  messages: {
    pageTitle: string;
    markAllRead: string;
    empty: string;
    loadMore: string;
  };
}

export function NotificationsListPage({
  initialItems,
  initialNextCursor,
  locale,
  messages,
}: Props) {
  const router = useRouter();
  const tt = useTranslations("app.notifications.types");
  const tNotif = useTranslations("app.notifications");
  const [items, setItems] = useState<SerializedNotification[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { liveArrivalTick } = useNotifications();
  const { showToast: showArrivalToast, count: bundledCount } = useNotificationBurstToast(liveArrivalTick);

  function handleMarkRead(item: SerializedNotification) {
    if (!item.read) {
      setItems((prev) =>
        prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)),
      );
      markNotificationReadAction(item._id).catch(() => {
        setItems((prev) =>
          prev.map((n) => (n._id === item._id ? { ...n, read: false } : n)),
        );
      });
    }
    if (item.href) router.push(item.href);
  }

  function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsReadAction().catch(() => {
      setItems(initialItems);
    });
  }

  function handleLoadMore() {
    if (!nextCursor || isPending) return;
    setLoadError(null);
    startTransition(async () => {
      const result = await loadMoreNotificationsAction(nextCursor);
      if (result.error) {
        setLoadError(result.error);
        return;
      }
      setItems((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    });
  }

  const hasUnread = items.some((n) => !n.read);

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{messages.pageTitle}</h1>
          {showArrivalToast && (
            <span role="status" aria-live="polite" className="text-xs font-medium text-primary">
              {tNotif("newNotifications", { count: bundledCount })}
            </span>
          )}
        </div>
        {hasUnread && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            {messages.markAllRead}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Bell className="size-8 opacity-40" />
          <p className="text-sm">{messages.empty}</p>
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((item) => {
            const hasParams = !!item.params && Object.keys(item.params).length > 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const displayTitle = hasParams ? (tt as any)(`${item.type}.title`, item.params) as string : item.title;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const displayBody = hasParams ? (tt as any)(`${item.type}.body`, item.params) as string : item.body;
            return (
              <li key={item._id}>
                <button
                  type="button"
                  onClick={() => handleMarkRead(item)}
                  className={[
                    "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !item.read ? "bg-accent/40" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center border",
                      !item.read ? "text-foreground" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {notificationIcon(item.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        "text-sm leading-snug",
                        !item.read ? "font-semibold text-accent-foreground" : "font-medium",
                      ].join(" ")}
                    >
                      {displayTitle}
                    </p>
                    <p
                      className={[
                        "mt-0.5 line-clamp-2 text-xs",
                        !item.read ? "text-accent-foreground" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {displayBody.length > 80 ? `${displayBody.slice(0, 80)}…` : displayBody}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(item.createdAt, locale)}
                    </span>
                    {!item.read && (
                      <span className="size-2 bg-primary" aria-hidden="true" />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {isPending && (
        <div className="flex flex-col divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <Skeleton className="mt-0.5 size-8 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="ghost" size="sm" onClick={handleLoadMore}>
            Retry
          </Button>
        </div>
      )}

      {nextCursor && !isPending && (
        <div className="border-t px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleLoadMore}
            disabled={isPending}
          >
            {messages.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}
