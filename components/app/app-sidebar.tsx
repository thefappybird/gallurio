"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import {
  CameraIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MessageSquareIcon,
  SettingsIcon,
  UsersIcon,
  UsersRound,
  BookOpenIcon,
} from "lucide-react";
import NextImage from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import { ClientUserButton } from "@/components/app/client-user-button";
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
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/app/theme-toggle";

const OWNER_NAV = [
  { href: "/dashboard" as const, labelKey: "dashboard", icon: LayoutDashboardIcon },
  { href: "/bookings" as const, labelKey: "bookings", icon: BookOpenIcon },
  { href: "/clients" as const, labelKey: "clients", icon: UsersIcon },
  { href: "/inquiries" as const, labelKey: "inquiries", icon: MessageSquareIcon },
  { href: "/portfolio" as const, labelKey: "portfolio", icon: CameraIcon },
  { href: "/teams" as const, labelKey: "teams", icon: UsersRound },
];

const MEMBER_NAV = [
  { href: "/bookings" as const, labelKey: "bookings", icon: BookOpenIcon },
];

type AppSidebarProps = {
  role: "owner" | "staff";
  workspaceName: string;
  workspaceLogoUrl?: string | null;
};

export function AppSidebar({ role, workspaceName, workspaceLogoUrl }: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("app.sidebar");
  const isOwner = role === "owner";
  const nav = isOwner ? OWNER_NAV : MEMBER_NAV;

  const initial = workspaceName[0]?.toUpperCase() ?? "W";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-0 group-data-[collapsible=icon]:items-center">
        <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
          <Link
            href="/settings"
            aria-label={workspaceName}
            className="grid size-10 shrink-0 place-items-center border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground font-semibold text-sm overflow-hidden"
          >
            {workspaceLogoUrl ? (
              <NextImage src={workspaceLogoUrl} alt="" fill className="object-cover" />
            ) : (
              initial
            )}
          </Link>
          <span className="truncate text-sm font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            {workspaceName}
          </span>
          <SidebarTrigger className="ml-auto size-8 shrink-0 group-data-[collapsible=icon]:ml-0" />
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
                      render={<Link href={href} />}
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
          {isOwner && (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/settings" />}
                tooltip={t("settings")}
                className="group-data-[collapsible=icon]:mx-auto"
              >
                <SettingsIcon className="size-5! shrink-0" />
                <span>{t("settings")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <div className="grid size-7 shrink-0 place-items-center">
                <ClientUserButton />
              </div>
              <span className="text-sm text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                {t("account")}
              </span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SignOutButton redirectUrl="/sign-in">
              <SidebarMenuButton
                tooltip={t("logOut")}
                className="group-data-[collapsible=icon]:mx-auto"
              >
                <LogOutIcon className="size-5 shrink-0" />
                <span>{t("logOut")}</span>
              </SidebarMenuButton>
            </SignOutButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
