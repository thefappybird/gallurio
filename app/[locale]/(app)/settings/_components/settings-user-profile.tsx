"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

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
  workspaceName: string;
};

export function SettingsUserProfile({
  role,
  pages,
  activeSlug,
  workspaceName,
}: Props) {
  const t = useTranslations("app.settings");

  const visiblePages = pages.filter(
    (p) => !p.ownerOnly || role === "owner",
  );
  const visiblePageSlugs = visiblePages.map((page) => page.slug).join(",");

  const serverActiveSlug = activeSlug ?? "account";
  const [activePageSlug, setActivePageSlug] = useState(serverActiveSlug);
  const [previousServerActiveSlug, setPreviousServerActiveSlug] = useState(serverActiveSlug);

  // A direct URL navigation still comes through the server and must become the
  // active client panel. Ordinary tab switches stay client-side so each form
  // remains mounted and keeps unsaved values instead of triggering a refetch.
  if (serverActiveSlug !== previousServerActiveSlug) {
    setPreviousServerActiveSlug(serverActiveSlug);
    setActivePageSlug(serverActiveSlug);
  }

  const currentPage = visiblePages.find((p) => p.slug === activePageSlug);

  const isPageActive = (page: SettingsPage) => page.slug === activePageSlug;
  const hrefFor = (page: SettingsPage) =>
    page.slug === "account" ? "/settings" : `/settings/${page.slug}`;

  useEffect(() => {
    const syncFromHistory = () => {
      const segments = window.location.pathname.split("/").filter(Boolean);
      const settingsIndex = segments.lastIndexOf("settings");
      const slugFromUrl = settingsIndex === -1 ? "account" : segments[settingsIndex + 1] ?? "account";
      if (visiblePageSlugs.split(",").includes(slugFromUrl)) {
        setActivePageSlug(slugFromUrl);
      }
    };

    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, [visiblePageSlugs]);

  return (
    <div className="flex w-full flex-col gap-0">
      {/* Workspace name bar */}
      <div className="flex w-full items-center justify-between border border-b-0 border-border bg-card px-4 py-3">
        <span className="min-w-0 truncate text-sm font-medium">{workspaceName}</span>
      </div>

      <div className="flex w-full flex-col border border-border">
        {/* Top tab rail: underline tabs at every breakpoint. Icon-over-label
            chips with scroll-snap below sm (native tab-bar feel); icon beside
            label from sm up. */}
        <nav
          aria-label={t("navigationLabel")}
          className="flex w-full snap-x snap-mandatory flex-row gap-1 overflow-x-auto border-b border-border bg-card px-2 sm:gap-2 sm:px-4"
        >
          {visiblePages.map((page) => {
            const isActive = isPageActive(page);
            return (
              <Link
                key={page.slug}
                href={hrefFor(page) as never}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => {
                  // Keep modifier-clicks and new tabs as normal links. A
                  // regular click only changes the mounted panel locally.
                  if (
                    isActive ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  setActivePageSlug(page.slug);
                  window.history.pushState(null, "", event.currentTarget.href);
                }}
                className={cn(
                  "flex min-h-14 shrink-0 snap-start flex-col items-center justify-center gap-1 border-b-2 border-transparent px-3 py-2 text-xs transition-colors",
                  "sm:min-h-11 sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-sm",
                  "hover:bg-accent/60 hover:text-foreground",
                  "focus-visible:bg-accent/60 focus-visible:text-foreground focus-visible:outline-none",
                  isActive
                    ? "border-brand font-medium text-brand"
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
          {currentPage ? visiblePages.map((page) => (
            <div key={page.slug} hidden={!isPageActive(page)}>
              {page.body}
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">{t("selectPage")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
