"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, ChevronsUpDownIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { setActiveWorkspaceAction } from "../_actions";

export type WorkspaceSwitcherItem = {
  id: string;
  name: string;
  logoUrl?: string | null;
};

type Props = {
  workspaces: WorkspaceSwitcherItem[];
  currentWorkspaceId: string;
};

export function SettingsOrgSwitcher({
  workspaces,
  currentWorkspaceId,
}: Props) {
  const t = useTranslations("app.settings.workspaceSwitcher");
  const [pending, startTransition] = useTransition();

  const current = workspaces.find((w) => w.id === currentWorkspaceId);

  function handleSelect(id: string) {
    if (id === currentWorkspaceId) return;
    startTransition(async () => {
      await setActiveWorkspaceAction(id);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("switchWorkspace")}
        disabled={pending}
        className={cn(
          "flex min-w-0 items-center gap-2 border border-border bg-background px-3 py-2 text-sm",
          "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {current?.name ?? t("noWorkspace")}
        </span>
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="bottom" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("yourWorkspaces")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((ws) => {
            const isActive = ws.id === currentWorkspaceId;
            return (
              <DropdownMenuItem
                key={ws.id}
                disabled={isActive}
                onClick={() => handleSelect(ws.id)}
                className="flex items-center gap-2"
                aria-current={isActive ? "true" : undefined}
              >
                <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                {isActive && (
                  <CheckIcon className="size-4 shrink-0 text-foreground" aria-hidden />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
