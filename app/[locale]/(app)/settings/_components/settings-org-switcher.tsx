"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { resolveScheme } from "@/lib/theme/themes";
import { buildUserProfileAppearance } from "@/lib/auth/userProfileAppearance";

export function SettingsOrgSwitcher() {
  const { resolvedTheme } = useTheme();
  const scheme = resolveScheme(resolvedTheme);
  const appearance = buildUserProfileAppearance({ scheme });

  return (
    <OrganizationSwitcher
      hidePersonal={true}
      afterSelectOrganizationUrl="/dashboard"
      afterCreateOrganizationUrl="/onboarding/business"
      appearance={appearance}
    />
  );
}
