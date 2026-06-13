import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import {
  Building2,
  Palette,
  Globe,
  Wrench,
  CreditCard,
  UserIcon,
} from "lucide-react";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { getAuthMethods } from "@/lib/auth/authMethods";
import { getActiveWorkspaceId } from "@/lib/auth/activeWorkspace";
import { getUserTimeFormat } from "@/lib/utils/get-user-time-format";
import { routing } from "@/lib/i18n/routing";
import { connectDB } from "@/lib/db/mongoose";
import { User, Workspace } from "@/lib/db/models";
import { SettingsUserProfile } from "../_components/settings-user-profile";
import { WorkspaceBusinessForm } from "../workspace/_business-form";
import { WorkspaceBrandingForm } from "../workspace/_branding-form";
import { CustomizePanel } from "../customize/_panel";
import { PublicPageSettingsForm } from "../public-page/_form";
import { DevPlanPanel } from "../dev-plan/_panel";
import { BillingPanel } from "../billing/_panel";
import { AccountPanel } from "../account/_panel";
import type {
  UpdateWorkspaceBusinessInput,
  UpdateWorkspaceBrandingInput,
  PublicPageSettingsInput,
  SupportedCountry,
  SupportedCurrency,
} from "@/lib/validators/workspace";

const OWNER_ONLY_SLUGS = new Set([
  "workspace",
  "public-page",
  "billing",
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

  const [{ role, workspace, userId }, authUser, initialTimeFormat] =
    await Promise.all([requireOrg(), getAuthUser(), getUserTimeFormat()]);

  const slug = catchall?.[0] ?? null;
  if (slug && OWNER_ONLY_SLUGS.has(slug) && role !== "owner") {
    notFound();
  }

  await connectDB();

  // Load full user doc for MFA state
  const userDoc = await User.findOne({ workosUserId: userId }).lean();
  const mfaEnabled = userDoc?.mfaEnabled ?? false;
  const { hasOAuth } = await getAuthMethods(userId);

  // Load all workspaces the user is a member of for the switcher
  const membershipWorkspaceIds = (userDoc?.memberships ?? []).map(
    (m) => m.workspaceId,
  );
  const memberWorkspaces = await Workspace.find(
    { _id: { $in: membershipWorkspaceIds } },
    { _id: 1, name: 1, "branding.logoUrl": 1 },
  ).lean();

  const workspaceSwitcherItems = memberWorkspaces.map((w) => ({
    id: String(w._id),
    name: w.name,
    logoUrl: (w as { branding?: { logoUrl?: string | null } }).branding?.logoUrl ?? null,
  }));

  const businessDefaults: UpdateWorkspaceBusinessInput = {
    name: workspace.name,
    slug: workspace.slug,
    businessType:
      workspace.businessType as UpdateWorkspaceBusinessInput["businessType"],
    country: (workspace.country ?? "PH") as SupportedCountry,
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

  // Active slug: null means base /settings -> render account tab
  const activeSlug = slug;

  return (
    <SettingsUserProfile
      role={role}
      activeSlug={activeSlug ?? "account"}
      workspaces={workspaceSwitcherItems}
      currentWorkspaceId={String(workspace._id)}
      pages={[
        {
          slug: "account",
          label: t("account"),
          icon: <UserIcon className="size-4" />,
          body: (
            <AccountPanel
              name={authUser?.name ?? ""}
              email={authUser?.email ?? ""}
              avatarUrl={userDoc?.avatarUrl ?? authUser?.avatarUrl ?? null}
              avatarCloudinaryPublicId={userDoc?.avatarCloudinaryPublicId ?? null}
              hasOAuth={hasOAuth}
              mfaEnabled={mfaEnabled}
            />
          ),
        },
        {
          slug: "customize",
          label: t("customize"),
          icon: <Palette className="size-4" />,
          body: <CustomizePanel initialTimeFormat={initialTimeFormat} />,
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
        {
          slug: "billing",
          label: t("billing"),
          icon: <CreditCard className="size-4" />,
          ownerOnly: true,
          body: (
            <BillingPanel
              currentPlan={workspace.plan as "free" | "starter" | "pro"}
              paddleSubscriptionStatus={
                (workspace.paddleSubscriptionStatus as
                  | "active"
                  | "canceled"
                  | "past_due"
                  | "paused"
                  | "trialing"
                  | null) ?? null
              }
              paddleCurrentPeriodEnd={workspace.paddleCurrentPeriodEnd ?? null}
              workspaceId={String(workspace._id)}
              customerEmail={authUser?.email ?? ""}
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
      ]}
    />
  );
}
