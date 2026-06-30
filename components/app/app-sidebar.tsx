"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { useIsRtl } from "@/lib/i18n/rtl";
import {
  BellIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
  ContactIcon,
  UsersRoundIcon,
  CalendarCheck2Icon,
  ImageIcon,
  MessageSquareIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationPopover } from "@/components/notifications/NotificationPopover";
import { useNotifications } from "@/lib/hooks/useNotifications";
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
import { LocaleSwitcher } from "@/components/app/locale-switcher";

const OWNER_NAV = [
  { href: "/dashboard" as const, labelKey: "dashboard", icon: LayoutDashboardIcon },
  { href: "/inquiries" as const, labelKey: "inquiries", icon: MessageSquareIcon },
  { href: "/bookings" as const, labelKey: "bookings", icon: CalendarCheck2Icon },
  { href: "/clients" as const, labelKey: "clients", icon: ContactIcon },
  { href: "/portfolio" as const, labelKey: "portfolio", icon: ImageIcon },
  { href: "/teams" as const, labelKey: "teams", icon: UsersRoundIcon },
];

const MEMBER_NAV = [
  { href: "/bookings" as const, labelKey: "bookings", icon: CalendarCheck2Icon },
  { href: "/clients" as const, labelKey: "clients", icon: ContactIcon },
  { href: "/teams" as const, labelKey: "teams", icon: UsersRoundIcon },
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
  // RTL locales anchor the sidebar to the inline-start edge (the right side).
  // The Sidebar primitive already positions side="right" correctly.
  const side = useIsRtl() ? "right" : "left";
  const t = useTranslations("app.sidebar");
  const tNotif = useTranslations("app.notifications");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [bellNudge, setBellNudge] = useState(false);
  const [showBellToast, setShowBellToast] = useState(false);
  const { isMobile, setOpenMobile } = useSidebar();
  const { unreadCount } = useNotifications();
  const prevUnreadRef = useRef(unreadCount);
  const bellToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setBellNudge(true);
      setShowBellToast(true);
      if (bellToastTimerRef.current) {
        clearTimeout(bellToastTimerRef.current);
      }
      bellToastTimerRef.current = setTimeout(() => {
        setShowBellToast(false);
        bellToastTimerRef.current = null;
      }, 2000);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);
  useEffect(() => {
    return () => {
      if (bellToastTimerRef.current) {
        clearTimeout(bellToastTimerRef.current);
      }
    };
  }, []);
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
    <Sidebar collapsible="icon" side={side}>
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

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {/* Bell / notifications — same structure as nav items */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<button type="button" />}
                  onClick={() => setBellOpen((v) => !v)}
                  isActive={bellOpen || pathname === "/notifications" || pathname.startsWith("/notifications/")}
                  tooltip={tNotif("bell")}
                  className="group-data-[collapsible=icon]:mx-auto"
                  aria-expanded={bellOpen}
                  aria-label={
                    unreadCount > 0
                      ? `${unreadCount > 99 ? "99+" : unreadCount} unread notifications`
                      : tNotif("bell")
                  }
                >
                  <span className="relative inline-flex shrink-0 group-data-[collapsible=icon]:inline-flex!">
                    <BellIcon
                      className={cn("size-5! shrink-0", bellNudge && "animate-bell-nudge")}
                      onAnimationEnd={() => setBellNudge(false)}
                    />
                    {unreadCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center bg-destructive px-1 text-[10px] leading-none font-medium text-destructive-foreground"
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                    {showBellToast ? (
                      <span
                        role="status"
                        aria-live="polite"
                        className="pointer-events-none absolute top-1/2 start-full z-10 ms-2 hidden -translate-y-1/2 whitespace-nowrap border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground md:inline-flex"
                      >
                        {tNotif("newNotification")}
                      </span>
                    ) : null}
                  </span>
                  <span>{tNotif("bell")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <LocaleSwitcher />
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
      <NotificationPopover open={bellOpen} onClose={() => setBellOpen(false)} />
    </Sidebar>
  );
}
