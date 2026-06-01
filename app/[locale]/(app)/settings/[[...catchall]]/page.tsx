import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import {
  Building2,
  Palette,
  Globe,
  AlertTriangle,
  ArrowLeftRight,
  Wrench,
} from "lucide-react";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getUserTimeFormat } from "@/lib/utils/get-user-time-format";
import { routing } from "@/lib/i18n/routing";
import { SettingsUserProfile } from "../_components/settings-user-profile";
import { SettingsOrgSwitcher } from "../_components/settings-org-switcher";
import { WorkspaceBusinessForm } from "../workspace/_business-form";
import { WorkspaceBrandingForm } from "../workspace/_branding-form";
import { CustomizePanel } from "../customize/_panel";
import { PublicPageSettingsForm } from "../public-page/_form";
import { DangerPanel } from "../danger/_panel";
import { DevPlanPanel } from "../dev-plan/_panel";
import type {
  UpdateWorkspaceBusinessInput,
  UpdateWorkspaceBrandingInput,
  PublicPageSettingsInput,
  HitpayCountry,
  SupportedCurrency,
} from "@/lib/validators/workspace";

const OWNER_ONLY_SLUGS = new Set([
  "workspace",
  "public-page",
  "danger",
  "dev-plan",
]);
const IS_DEV = process.env.NODE_ENV !== "production";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.sidebar");
  return { title: t("settings") };
}

export default async function SettingsCatchallPage({
  params,
}: {
  params: Promise<{ locale: string; catchall?: string[] }>;
}) {
  const { locale, catchall } = await params;
  setRequestLocale(locale);

  const [{ role, workspace }, initialTimeFormat] = await Promise.all([
    requireOrg(),
    getUserTimeFormat(),
  ]);

  const slug = catchall?.[0];
  if (slug && OWNER_ONLY_SLUGS.has(slug) && role !== "owner") {
    notFound();
  }

  const businessDefaults: UpdateWorkspaceBusinessInput = {
    name: workspace.name,
    slug: workspace.slug,
    businessType: workspace.businessType as UpdateWorkspaceBusinessInput["businessType"],
    country: (workspace.country ?? "PH") as HitpayCountry,
    currency: workspace.currency as SupportedCurrency,
    timezone: workspace.timezone ?? "Asia/Manila",
  };

  const brandingDefaults: UpdateWorkspaceBrandingInput = {
    logoUrl: workspace.branding?.logoUrl ?? null,
    logoCloudinaryPublicId: workspace.branding?.logoCloudinaryPublicId ?? null,
    primaryColor: workspace.branding?.primaryColor ?? "#111111",
    secondaryColor: workspace.branding?.secondaryColor ?? "#f5f5f5",
    tagline: workspace.branding?.tagline ?? "",
    description: workspace.branding?.description ?? "",
  };

  const publicPageDefaults: PublicPageSettingsInput = {
    seoTitle: workspace.publicPage?.seoTitle ?? "",
    seoDescription: workspace.publicPage?.seoDescription ?? "",
    inquiryRecipientEmail: workspace.publicPage?.inquiryRecipientEmail ?? "",
  };

  const t = await getTranslations("app.settings.tabs");

  const mountPath =
    locale === routing.defaultLocale ? "/settings" : `/${locale}/settings`;

  return (
    <SettingsUserProfile
      path={mountPath}
      role={role}
      pages={[
        {
          slug: "customize",
          label: t("customize"),
          icon: <Palette className="size-4" />,
          body: <CustomizePanel initialTimeFormat={initialTimeFormat} />,
        },
        {
          slug: "switch-workspace",
          label: t("switchWorkspace"),
          icon: <ArrowLeftRight className="size-4" />,
          body: <SettingsOrgSwitcher />,
        },
        {
          slug: "workspace",
          label: t("workspace"),
          icon: <Building2 className="size-4" />,
          ownerOnly: true,
          body: (
            <div className="flex flex-col gap-8">
              <WorkspaceBusinessForm defaults={businessDefaults} />
              <WorkspaceBrandingForm defaults={brandingDefaults} />
            </div>
          ),
        },
        {
          slug: "public-page",
          label: t("publicPage"),
          icon: <Globe className="size-4" />,
          ownerOnly: true,
          body: (
            <PublicPageSettingsForm
              slug={workspace.slug}
              publishedAt={workspace.publicPage?.publishedAt ?? null}
              defaults={publicPageDefaults}
              locale={locale}
            />
          ),
        },
        ...(IS_DEV
          ? ([
              {
                slug: "dev-plan",
                label: t("devPlan"),
                icon: <Wrench className="size-4" />,
                ownerOnly: true,
                body: (
                  <DevPlanPanel
                    currentPlan={workspace.plan as "free" | "starter" | "pro"}
                  />
                ),
              },
            ] as const)
          : []),
        {
          slug: "danger",
          label: t("danger"),
          icon: <AlertTriangle className="size-4" />,
          ownerOnly: true,
          body: <DangerPanel workspaceName={workspace.name} workspaceSlug={workspace.slug} />,
        },
      ]}
    />
  );
}
