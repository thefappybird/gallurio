"use client";

import { type ReactNode, Children, isValidElement } from "react";
import { UserProfile } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { resolveScheme } from "@/lib/theme/themes";
import { buildUserProfileAppearance } from "@/lib/auth/userProfileAppearance";

type LabelKey = "customize" | "workspace" | "publicPage" | "danger";

type CustomPageProps = {
  slug: string;
  labelKey: LabelKey;
  // Pre-rendered JSX (e.g. <Palette className="size-4" />). Must NOT be a raw
  // component reference — RSC cannot serialize functions across the boundary.
  labelIcon: ReactNode;
  ownerOnly?: boolean;
  children: ReactNode;
};

// Marker component — never rendered directly; SettingsUserProfile reads its props.
// The component accepts typed props so callers get type-checking, but the
// implementation ignores them (it's a data-carrier, not a renderer).
export const CustomPage: (props: CustomPageProps) => ReactNode = () => null;

type Role = "owner" | "staff";

export function SettingsUserProfile({
  path,
  role,
  children,
}: {
  path: string;
  role: Role;
  children: ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const scheme = resolveScheme(resolvedTheme);
  const t = useTranslations("app.settings.tabs");

  const customPages = Children.toArray(children).filter(
    (c): c is React.ReactElement<CustomPageProps> =>
      isValidElement(c) && (c as React.ReactElement<CustomPageProps>).type === CustomPage
  );

  return (
    <UserProfile path={path} routing="path" appearance={buildUserProfileAppearance({ scheme })}>
      {customPages.map((pageEl) => {
        const { slug, labelKey, labelIcon, ownerOnly, children: pageChildren } = pageEl.props;
        if (ownerOnly && role !== "owner") return null;
        return (
          <UserProfile.Page
            key={slug}
            label={t(labelKey)}
            url={slug}
            labelIcon={labelIcon}
          >
            {pageChildren}
          </UserProfile.Page>
        );
      })}
    </UserProfile>
  );
}
