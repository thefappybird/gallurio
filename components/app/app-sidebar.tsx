"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  CameraIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  SettingsIcon,
  UsersIcon,
  BookOpenIcon,
} from "lucide-react";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
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
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/bookings", label: "Bookings", icon: BookOpenIcon },
  { href: "/clients", label: "Clients", icon: UsersIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/inquiries", label: "Inquiries", icon: MessageSquareIcon },
  { href: "/gallery", label: "Gallery", icon: CameraIcon },
];

export function AppSidebar() {
  const pathname = usePathname();

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
                  "w-full justify-start rounded-md px-2 py-1.5 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
              {navItems.map(({ href, label, icon: Icon }) => (
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/settings" />} tooltip="Settings">
              <SettingsIcon />
              <span>Settings</span>
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
                Account
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
