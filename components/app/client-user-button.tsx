"use client";

import * as React from "react";
import { SettingsIcon, LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SignOutConfirmDialog } from "@/components/app/sign-out-confirm";

type Props = {
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

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

export function ClientUserButton({ name, email, avatarUrl }: Props) {
  const t = useTranslations("app.sidebar");
  const initials = getInitials(name, email);
  const [logoutOpen, setLogoutOpen] = React.useState(false);

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("accountMenu")}
        className={[
          "grid size-7 shrink-0 place-items-center overflow-hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ].join(" ")}
      >
        <Avatar size="sm" className="size-7">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={name ?? email} />
          ) : null}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="truncate text-sm font-medium text-foreground">
              {name ?? email}
            </span>
            {name && (
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Settings link — render as an <a> via next-intl Link */}
          <DropdownMenuItem render={<Link href="/settings" />}>
            <SettingsIcon className="size-4 shrink-0" aria-hidden />
            {t("settings")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Sign-out — opens a confirmation dialog before clearing the session */}
          <DropdownMenuItem
            render={
              <button type="button" className="w-full text-destructive" />
            }
            onClick={() => setLogoutOpen(true)}
          >
            <LogOutIcon className="size-4 shrink-0" aria-hidden />
            {t("logOut")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <SignOutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </>
  );
}
