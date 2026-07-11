"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
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

  const currentPage = visiblePages.find((p) => p.slug === activeSlug);

  const isPageActive = (page: SettingsPage) => page.slug === activeSlug;
  const hrefFor = (page: SettingsPage) =>
    page.slug === "account" ? "/settings" : `/settings/${page.slug}`;

  // Manual pending flag: a tab click can't rely on next/link's own pending
  // instrumentation here (this nav renders in both a mobile strip and a
  // desktop sidebar sharing one piece of state). Set on click, cleared once
  // the server round trip lands and `activeSlug` catches up to the click.
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [prevActiveSlug, setPrevActiveSlug] = useState(activeSlug);
  if (activeSlug !== prevActiveSlug) {
    setPrevActiveSlug(activeSlug);
    setPendingSlug(null);
  }

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
            const isPending = pendingSlug === page.slug;
            return (
              <Link
                key={page.slug}
                href={hrefFor(page) as never}
                aria-current={isActive ? "page" : undefined}
                aria-busy={isPending ? "true" : undefined}
                onClick={() => { if (!isActive) setPendingSlug(page.slug); }}
                className={cn(
                  "flex min-h-14 shrink-0 snap-start flex-col items-center justify-center gap-1 border-b-2 border-transparent px-3 py-2 text-xs transition-colors",
                  "sm:min-h-11 sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-sm",
                  "hover:bg-accent/60 hover:text-foreground",
                  "focus-visible:bg-accent/60 focus-visible:text-foreground focus-visible:outline-none",
                  isActive
                    ? "border-brand font-medium text-brand"
                    : "text-muted-foreground",
                  isPending && "opacity-60",
                )}
              >
                <span className="shrink-0 [&_svg]:size-4" aria-hidden>
                  {isPending ? <Loader2 className="animate-spin" /> : page.icon}
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
