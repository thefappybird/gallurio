"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, MessageSquare, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/[locale]/(app)/notifications/_actions";
import {
  loadMoreNotificationsAction,
  type SerializedNotification,
} from "@/app/[locale]/(app)/notifications/_load-more-action";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

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
  messages,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<SerializedNotification[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        <h1 className="text-xl font-semibold tracking-tight">{messages.pageTitle}</h1>
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
          {items.map((item) => (
            <li key={item._id}>
              <button
                type="button"
                onClick={() => handleMarkRead(item)}
                className={[
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                      !item.read ? "font-semibold" : "font-medium",
                    ].join(" ")}
                  >
                    {item.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {item.body.length > 80 ? `${item.body.slice(0, 80)}…` : item.body}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {relativeTime(item.createdAt)}
                  </span>
                  {!item.read && (
                    <span className="size-2 bg-primary" aria-hidden="true" />
                  )}
                </div>
              </button>
            </li>
          ))}
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
