"use client";

import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { SettingsOrgSwitcher } from "./settings-org-switcher";
import type { WorkspaceSwitcherItem } from "./settings-org-switcher";

export type Role = "owner" | "staff";

export type SettingsPage = {
  slug:
    | "account"
    | "customize"
    | "workspace"
    | "public-page"
    | "billing"
    | "teams"
    | "dev-plan";
  label: string;
  icon: ReactNode;
  body: ReactNode;
  ownerOnly?: boolean;
};

type Props = {
  role: Role;
  pages: SettingsPage[];
  activeSlug: string | null;
  workspaces: WorkspaceSwitcherItem[];
  currentWorkspaceId: string;
};

export function SettingsUserProfile({
  role,
  pages,
  activeSlug,
  workspaces,
  currentWorkspaceId,
}: Props) {
  const t = useTranslations("app.settings");

  const visiblePages = pages.filter(
    (p) => !p.ownerOnly || role === "owner",
  );

  const currentPage = visiblePages.find((p) => p.slug === activeSlug);

  const isPageActive = (page: SettingsPage) => page.slug === activeSlug;
  const hrefFor = (page: SettingsPage) =>
    page.slug === "account" ? "/settings" : `/settings/${page.slug}`;

  return (
    <div className="flex w-full flex-col gap-0">
      {/* Workspace switcher bar */}
      <div className="flex w-full items-center justify-between border border-b-0 border-border bg-card px-4 py-3">
        {workspaces.length >= 2 ? (
          <SettingsOrgSwitcher
            workspaces={workspaces}
            currentWorkspaceId={currentWorkspaceId}
          />
        ) : (
          <span className="min-w-0 truncate text-sm font-medium">
            {workspaces.find((w) => w.id === currentWorkspaceId)?.name ??
              workspaces[0]?.name ??
              ""}
          </span>
        )}
      </div>

      {/* Two-column layout: nav sidebar + panel (stacks below lg) */}
      <div className="flex w-full flex-col border border-border lg:flex-row">
        {/* Nav: horizontally-scrollable tab strip below lg, vertical sidebar at lg+ */}
        <nav
          aria-label={t("navigationLabel")}
          className="flex w-full flex-row gap-1 overflow-x-auto border-b border-border bg-card lg:hidden"
        >
          {visiblePages.map((page) => {
            const isActive = isPageActive(page);
            return (
              <Link
                key={page.slug}
                href={hrefFor(page) as never}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 px-4 py-3 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
                  isActive
                    ? "bg-brand/12 font-medium text-brand"
                    : "text-muted-foreground",
                )}
              >
                <span className="shrink-0 [&_svg]:size-4" aria-hidden>
                  {page.icon}
                </span>
                <span>{page.label}</span>
              </Link>
            );
          })}
        </nav>
        <nav
          aria-label={t("navigationLabel")}
          className="hidden w-48 shrink-0 flex-col border-e border-border bg-card lg:flex"
        >
          {visiblePages.map((page) => {
            const isActive = isPageActive(page);
            return (
              <Link
                key={page.slug}
                href={hrefFor(page) as never}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
                  isActive
                    ? "bg-brand/12 font-medium text-brand"
                    : "text-muted-foreground",
                )}
              >
                <span className="shrink-0 [&_svg]:size-4" aria-hidden>
                  {page.icon}
                </span>
                <span>{page.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Panel */}
        <div className="min-w-0 flex-1 p-6">
          {currentPage ? (
            currentPage.body
          ) : (
            <p className="text-sm text-muted-foreground">{t("selectPage")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
