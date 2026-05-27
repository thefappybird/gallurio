import { requireOrg } from "@/lib/auth/requireOrg";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { cookies } from "next/headers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace } = await requireOrg();

  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state");
  const defaultOpen = sidebarState ? sidebarState.value === "true" : true;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        workspaceName={workspace.name}
        workspaceLogoUrl={workspace.branding?.logoUrl ?? null}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="md:hidden" />
          <Separator orientation="vertical" className="h-6" />
        </header>
        <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
}
