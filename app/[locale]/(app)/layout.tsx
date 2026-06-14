import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { cookies } from "next/headers";
import { TimeFormatProvider } from "@/lib/time-format/context";
import { getUserTimeFormat } from "@/lib/utils/get-user-time-format";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ role, workspace, userAvatarUrl }, authUser, cookieStore, timeFormat] =
    await Promise.all([
      requireOrg(),
      getAuthUser(),
      cookies(),
      getUserTimeFormat(),
    ]);

  const sidebarState = cookieStore.get("sidebar_state");
  const defaultOpen = sidebarState ? sidebarState.value === "true" : true;

  return (
    <TimeFormatProvider initialValue={timeFormat}>
      <SidebarProvider defaultOpen={defaultOpen}>
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
      </SidebarProvider>
    </TimeFormatProvider>
  );
}
