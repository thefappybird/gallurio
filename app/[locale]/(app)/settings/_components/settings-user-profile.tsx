"use client";

import { type ReactNode } from "react";
import { UserProfile } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { resolveScheme } from "@/lib/theme/themes";
import { buildUserProfileAppearance } from "@/lib/auth/userProfileAppearance";

type Role = "owner" | "staff";

export type SettingsPage = {
  slug: "customize" | "workspace" | "public-page" | "danger" | "switch-workspace";
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

  const customize = pages.find((p) => p.slug === "customize");
  const switchWorkspace = pages.find((p) => p.slug === "switch-workspace");
  const workspace = pages.find((p) => p.slug === "workspace");
  const publicPage = pages.find((p) => p.slug === "public-page");
  const danger = pages.find((p) => p.slug === "danger");

  return (
    <UserProfile path={path} routing="path" appearance={buildUserProfileAppearance({ scheme })}>
      {customize && (
        <UserProfile.Page
          label={customize.label}
          url={customize.slug}
          labelIcon={customize.icon}
        >
          {customize.body}
        </UserProfile.Page>
      )}
      {switchWorkspace && (
        <UserProfile.Page
          label={switchWorkspace.label}
          url={switchWorkspace.slug}
          labelIcon={switchWorkspace.icon}
        >
          {switchWorkspace.body}
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
      {publicPage && (role === "owner" || !publicPage.ownerOnly) && (
        <UserProfile.Page
          label={publicPage.label}
          url={publicPage.slug}
          labelIcon={publicPage.icon}
        >
          {publicPage.body}
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
  );
}
