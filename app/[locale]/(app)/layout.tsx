import { NextIntlClientProvider } from "next-intl";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { getAppMessages } from "@/lib/vocabulary/appTranslations";
import { resolveVocabularyPreset } from "@/lib/vocabulary/resolve";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { cookies } from "next/headers";
import { TimeFormatProvider } from "@/lib/time-format/context";
import { getUserTimeFormat } from "@/lib/utils/get-user-time-format";
import { AppQueryProvider } from "@/components/app/app-query-provider";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import { HistoryRefreshGuard } from "@/components/app/history-refresh-guard";
import { BetaEndingBanner } from "@/components/app/beta-ending-banner";
import { getBetaProgramAnnouncement, shouldShowBetaEndingWarning } from "@/lib/billing/betaProgram";
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

  const [recentNotifications, unreadCount, betaProgram] = await Promise.all([
    getRecentNotifications(workspaceId, userId, 10),
    getUnreadCount(workspaceId, userId),
    getBetaProgramAnnouncement(),
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

  const appMessages = await getAppMessages(resolveVocabularyPreset(workspace));

  const sidebarState =cookieStore.get("sidebar_state");
  const defaultOpen = sidebarState ? sidebarState.value === "true" : true;
  const showBetaEndingBanner =
    workspace.plan === "beta" &&
    shouldShowBetaEndingWarning(betaProgram?.scheduledEndAt, betaProgram?.closedAt);

  return (
    // Full request-locale catalog with the workspace's vocabulary preset
    // applied (restores the pre-scoping behaviour; see lib/i18n/clientMessages.ts).
    <NextIntlClientProvider messages={appMessages}>
      <TimeFormatProvider initialValue={timeFormat}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppQueryProvider key={workspaceId} workspaceId={workspaceId}>
            <NotificationProvider
              key={workspaceId}
              workspaceId={workspaceId}
              initialNotifications={initialNotifications}
              initialUnreadCount={unreadCount}
            >
              <HistoryRefreshGuard />
              <AppSidebar
                role={role}
                workspaceName={workspace.name}
                workspaceLogoUrl={null}
                userName={authUser?.name ?? null}
                userEmail={authUser?.email ?? ""}
                userAvatarUrl={userAvatarUrl ?? authUser?.avatarUrl ?? null}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                {showBetaEndingBanner && betaProgram?.scheduledEndAt && (
                  <BetaEndingBanner
                    key={betaProgram.scheduledEndAt.toISOString()}
                    scheduledEndAt={betaProgram.scheduledEndAt.toISOString()}
                  />
                )}
                {/* Mobile-only top bar: the sidebar is an off-canvas sheet on phones,
                    so its in-sheet trigger is unreachable when closed. This surfaces a
                    trigger (and the notification bell lives inside the sidebar) so
                    mobile users can actually open the nav. */}
                <header
                  data-slot="app-topbar"
                  className="flex items-center gap-2 border-b border-border bg-background px-4 py-2 md:hidden"
                >
                  <SidebarTrigger className="size-9 shrink-0 border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {workspace.name}
                  </span>
                </header>
                <main className="flex min-w-0 flex-1 flex-col gap-6 overflow-auto p-6">
                  {children}
                </main>
              </div>
            </NotificationProvider>
          </AppQueryProvider>
        </SidebarProvider>
      </TimeFormatProvider>
    </NextIntlClientProvider>
  );
}
