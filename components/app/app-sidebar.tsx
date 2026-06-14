"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import {
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
  ContactIcon,
  UsersRoundIcon,
  CalendarCheck2Icon,
  ImageIcon,
  MessageSquareIcon,
} from "lucide-react";
import NextImage from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutConfirmDialog } from "@/components/app/sign-out-confirm";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/app/theme-toggle";

const OWNER_NAV = [
  { href: "/dashboard" as const, labelKey: "dashboard", icon: LayoutDashboardIcon },
  { href: "/bookings" as const, labelKey: "bookings", icon: CalendarCheck2Icon },
  { href: "/clients" as const, labelKey: "clients", icon: ContactIcon },
  { href: "/inquiries" as const, labelKey: "inquiries", icon: MessageSquareIcon },
  { href: "/portfolio" as const, labelKey: "portfolio", icon: ImageIcon },
  { href: "/teams" as const, labelKey: "teams", icon: UsersRoundIcon },
];

const MEMBER_NAV = [
  { href: "/bookings" as const, labelKey: "bookings", icon: CalendarCheck2Icon },
  { href: "/clients" as const, labelKey: "clients", icon: ContactIcon },
];

function getInitials(name: string | null, email: string): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }
    return (parts[0]![0] ?? "").toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "U";
}

type AppSidebarProps = {
  role: "owner" | "staff";
  workspaceName: string;
  workspaceLogoUrl?: string | null;
  userName: string | null;
  userEmail: string;
  userAvatarUrl: string | null;
};

export function AppSidebar({
  role,
  workspaceName,
  workspaceLogoUrl,
  userName,
  userEmail,
  userAvatarUrl,
}: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("app.sidebar");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnNav = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  const isOwner = role === "owner";
  const nav = isOwner ? OWNER_NAV : MEMBER_NAV;

  const initial = workspaceName[0]?.toUpperCase() ?? "W";
  const accountInitials = getInitials(userName, userEmail);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-0">
        <div
          data-testid="sidebar-workspace-header"
          className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:flex-col-reverse group-data-[collapsible=icon]:items-center"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
            <Link
              href="/settings"
              aria-label={workspaceName}
              className="grid size-10 shrink-0 place-items-center overflow-hidden border border-sidebar-border bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground"
            >
              {workspaceLogoUrl ? (
                <NextImage src={workspaceLogoUrl} alt="" fill className="object-cover" />
              ) : (
                initial
              )}
            </Link>
            <span
              title={workspaceName}
              className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden"
            >
              {workspaceName}
            </span>
          </div>
          <SidebarTrigger className="size-9 shrink-0 border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>
      </SidebarHeader>

      <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map(({ href, labelKey, icon: Icon }) => {
                const label = t(labelKey);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} onClick={closeOnNav} />}
                      isActive={pathname === href || pathname.startsWith(href + "/")}
                      tooltip={label}
                      className="group-data-[collapsible=icon]:mx-auto"
                    >
                      <Icon className="size-5! shrink-0" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" onClick={closeOnNav} />}
              tooltip={t("settings")}
              className="group-data-[collapsible=icon]:mx-auto"
            >
              <SettingsIcon className="size-5! shrink-0" />
              <span>{t("settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<button type="button" />}
              onClick={() => setLogoutOpen(true)}
              tooltip={t("logOut")}
              className="group-data-[collapsible=icon]:mx-auto text-destructive"
            >
              <LogOutIcon className="size-5! shrink-0" />
              <span>{t("logOut")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            {/* Account identity is presentational only. */}
            <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <Avatar size="sm" className="size-7 shrink-0">
                {userAvatarUrl ? (
                  <AvatarImage src={userAvatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="text-xs">{accountInitials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {userName ?? userEmail}
                </span>
                {userName ? (
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {userEmail}
                  </span>
                ) : null}
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SignOutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </Sidebar>
  );
}
