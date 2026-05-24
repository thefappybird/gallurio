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
  BookOpenIcon,
} from "lucide-react";
import { UserButton, OrganizationSwitcher, SignOutButton } from "@clerk/nextjs";
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
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/app/theme-toggle";
const NAV = [
  { href: "/dashboard" as const, labelKey: "dashboard", icon: LayoutDashboardIcon },
  { href: "/bookings" as const, labelKey: "bookings", icon: BookOpenIcon },
  { href: "/clients" as const, labelKey: "clients", icon: UsersIcon },
  { href: "/inquiries" as const, labelKey: "inquiries", icon: MessageSquareIcon },
  { href: "/gallery" as const, labelKey: "gallery", icon: CameraIcon },
];

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("app.sidebar");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-2">
        <div className="px-2 py-1">
          <OrganizationSwitcher
            hidePersonal
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger:
                  "w-full justify-start px-2 py-1.5 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              },
            }}
          />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ href, labelKey, icon: Icon }) => {
                const label = t(labelKey);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} />}
                      isActive={pathname === href || pathname.startsWith(href + "/")}
                      tooltip={label}
                    >
                      <Icon />
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
            <SidebarMenuButton render={<Link href="/settings" />} tooltip={t("settings")}>
              <SettingsIcon />
              <span>{t("settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <UserButton
                appearance={{
                  elements: { avatarBox: "size-6" },
                }}
              />
              <span className="text-sm text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                {t("account")}
              </span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SignOutButton redirectUrl="/sign-in">
              <SidebarMenuButton tooltip={t("logOut")}>
                <LogOutIcon />
                <span>{t("logOut")}</span>
              </SidebarMenuButton>
            </SignOutButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
