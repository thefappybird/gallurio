import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { cookies } from "next/headers";
import { TimeFormatProvider } from "@/lib/time-format/context";
import { getUserTimeFormat } from "@/lib/utils/get-user-time-format";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import {
  getRecentNotifications,
  getUnreadCount,
} from "@/lib/db/queries/notifications";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ role, workspace, userAvatarUrl, userId, workspaceId }, authUser, cookieStore, timeFormat] =
    await Promise.all([
      requireOrg(),
      getAuthUser(),
      cookies(),
      getUserTimeFormat(),
    ]);

  const [recentNotifications, unreadCount] = await Promise.all([
    getRecentNotifications(workspaceId, userId, 10),
    getUnreadCount(workspaceId, userId),
  ]);

  const initialNotifications = recentNotifications.map((n) => ({
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
  }));

  const sidebarState = cookieStore.get("sidebar_state");
  const defaultOpen = sidebarState ? sidebarState.value === "true" : true;

  return (
    <TimeFormatProvider initialValue={timeFormat}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <NotificationProvider
          initialNotifications={initialNotifications}
          initialUnreadCount={unreadCount}
        >
          <AppSidebar
            role={role}
            workspaceName={workspace.name}
            workspaceLogoUrl={workspace.branding?.logoUrl ?? null}
            userName={authUser?.name ?? null}
            userEmail={authUser?.email ?? ""}
            userAvatarUrl={userAvatarUrl ?? authUser?.avatarUrl ?? null}
          />
          <main className="flex min-w-0 flex-1 flex-col gap-6 overflow-auto p-6">
            {children}
          </main>
        </NotificationProvider>
      </SidebarProvider>
    </TimeFormatProvider>
  );
}
