"use client";

import { type ReactNode } from "react";
import { UserProfile } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { resolveScheme } from "@/lib/theme/themes";
import { buildUserProfileAppearance } from "@/lib/auth/userProfileAppearance";
import { SettingsOrgSwitcher } from "./settings-org-switcher";

type Role = "owner" | "staff";

export type SettingsPage = {
  slug:
    | "customize"
    | "workspace"
    | "public-page"
    | "danger"
    | "teams"
    | "dev-plan";
  label: string;
  icon: ReactNode;
  body: ReactNode;
  ownerOnly?: boolean;
};

export function SettingsUserProfile({
  path,
  role,
  pages,
}: {
  path: string;
  role: Role;
  pages: SettingsPage[];
}) {
  const { resolvedTheme } = useTheme();
  const scheme = resolveScheme(resolvedTheme);
  const t = useTranslations("app.settings.tabs");

  const customize = pages.find((p) => p.slug === "customize");
  const workspace = pages.find((p) => p.slug === "workspace");
  const teams = pages.find((p) => p.slug === "teams");
  const publicPage = pages.find((p) => p.slug === "public-page");
  const devPlan = pages.find((p) => p.slug === "dev-plan");
  const danger = pages.find((p) => p.slug === "danger");

  return (
    <div className="flex w-full flex-col gap-0">
      {/* Persistent workspace switcher bar — always visible above the Clerk card */}
      <div className="flex w-full items-center justify-between border border-b-0 border-border bg-card px-4 py-3">
        <span className="text-sm font-medium text-card-foreground">
          {t("currentWorkspace")}
        </span>
        <SettingsOrgSwitcher />
      </div>

      {/* Clerk UserProfile card — fills available width */}
      <UserProfile
        path={path}
        routing="path"
        appearance={buildUserProfileAppearance({ scheme })}
        apiKeysProps={{ hide: true }}
      >
        {customize && (
          <UserProfile.Page
            label={customize.label}
            url={customize.slug}
            labelIcon={customize.icon}
          >
            {customize.body}
          </UserProfile.Page>
        )}
        {workspace && (role === "owner" || !workspace.ownerOnly) && (
          <UserProfile.Page
            label={workspace.label}
            url={workspace.slug}
            labelIcon={workspace.icon}
          >
            {workspace.body}
          </UserProfile.Page>
        )}
        {teams && (role === "owner" || !teams.ownerOnly) && (
          <UserProfile.Page
            label={teams.label}
            url={teams.slug}
            labelIcon={teams.icon}
          >
            {teams.body}
          </UserProfile.Page>
        )}
        {publicPage && (role === "owner" || !publicPage.ownerOnly) && (
          <UserProfile.Page
            label={publicPage.label}
            url={publicPage.slug}
            labelIcon={publicPage.icon}
          >
            {publicPage.body}
          </UserProfile.Page>
        )}
        {devPlan && (role === "owner" || !devPlan.ownerOnly) && (
          <UserProfile.Page
            label={devPlan.label}
            url={devPlan.slug}
            labelIcon={devPlan.icon}
          >
            {devPlan.body}
          </UserProfile.Page>
        )}
        {danger && (role === "owner" || !danger.ownerOnly) && (
          <UserProfile.Page
            label={danger.label}
            url={danger.slug}
            labelIcon={danger.icon}
          >
            {danger.body}
          </UserProfile.Page>
        )}
      </UserProfile>
    </div>
  );
}
