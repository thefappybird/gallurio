import { requireOrg } from "@/lib/auth/requireOrg";
import { listNotifications } from "@/lib/db/queries/notifications";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { NotificationsListPage } from "./_components/NotificationsListPage";
import type { SerializedNotification } from "./_load-more-action";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.notifications");
  return { title: t("pageTitle") };
}

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.notifications");

  const { workspace, userId } = await requireOrg();
  const sp = await searchParams;

  const { items, nextCursor } = await listNotifications(
    String(workspace._id),
    userId,
    { cursor: sp.cursor, limit: 20 },
  );

  const serialized: SerializedNotification[] = items.map((n) => ({
    _id: String(n._id),
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    entityId: String(n.entityId),
    entityType: n.entityType,
    read: n.read,
    readAt: n.readAt ? new Date(n.readAt as unknown as Date).toISOString() : null,
    createdAt: new Date(n.createdAt as unknown as Date).toISOString(),
    params: n.params as Record<string, string | undefined> | undefined,
  }));

  return (
    <NotificationsListPage
      initialItems={serialized}
      initialNextCursor={nextCursor}
      locale={locale}
      messages={{
        pageTitle: t("pageTitle"),
        markAllRead: t("markAllRead"),
        empty: t("empty"),
        loadMore: t("loadMore"),
      }}
    />
  );
}
