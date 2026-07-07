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
import { getUserTimeFormat } from "@/lib/utils/get-user-time-format";
import { connectDB } from "@/lib/db/mongoose";
import { User, Workspace, PortfolioDraft } from "@/lib/db/models";
import { resolveActiveDraftId } from "@/lib/page-builder/activeDraft";
import {
  normalizeDraftSeoFields,
  normalizePublishedSeoFields,
  hasPendingSeoChanges,
} from "@/lib/portfolio/publicPageSeoFields";
import { SettingsUserProfile } from "../_components/settings-user-profile";
import { WorkspaceBusinessForm } from "../workspace/_business-form";
import { CustomizePanel } from "../customize/_panel";
import { PublicPageSettingsForm } from "../public-page/_form";
import { DevPlanPanel } from "../dev-plan/_panel";
import { BillingPanel } from "../billing/_panel";
import { getProPricing } from "@/lib/paddle/pricing";
import { AccountPanel } from "../account/_panel";
import { portfolioSiteIconUrl } from "@/lib/storage/portfolioAssetUrls";
import type {
  UpdateWorkspaceBusinessInput,
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
    { _id: 1, name: 1 },
  ).lean();

  const workspaceSwitcherItems = memberWorkspaces.map((w) => ({
    id: String(w._id),
    name: w.name,
    logoUrl: null,
  }));

  const businessDefaults: UpdateWorkspaceBusinessInput = {
    name: workspace.name,
    slug: workspace.slug,
    businessType:
      workspace.businessType as UpdateWorkspaceBusinessInput["businessType"],
    country: (workspace.country ?? "PH") as SupportedCountry,
    currency: workspace.currency as SupportedCurrency,
    timezone: workspace.timezone ?? "Asia/Manila",
    contactEmail: workspace.contact?.email ?? "",
    contactAddress: workspace.contact?.address ?? "",
    logoUrl: workspace.logoUrl ?? "",
    logoAssetId: workspace.logoAssetId ?? "",
  };

  // Bundled SEO/icon fields now live on the active draft, not the stale
  // published publicPage — read from the resolved active draft so the form
  // shows the last save instead of reverting to live values on reload.
  const draftId = await resolveActiveDraftId(workspace._id);
  const draft = await PortfolioDraft.findOne(
    { _id: draftId },
    { seoTitle: 1, seoDescription: 1, siteIcon: 1, seo: 1 },
  ).lean();
  const draftFields = normalizeDraftSeoFields(draft);
  const publishedFields = normalizePublishedSeoFields(workspace.publicPage);
  const initialHasPendingChanges = hasPendingSeoChanges(draftFields, publishedFields);
  // keywords aren't editable in this form (only the Story Prompt wizard writes
  // them) — compute once server-side and OR it into every client recompute so
  // a Save can't incorrectly clear the pending banner while keywords still differ.
  const keywordsPending =
    JSON.stringify(draftFields.seo.keywords) !== JSON.stringify(publishedFields.seo.keywords);

  const publicPageDefaults: PublicPageSettingsInput = {
    seoTitle: draftFields.seoTitle,
    seoDescription: draftFields.seoDescription,
    // Default inquiry routing to the owner's own email until they set another.
    // This field alone stays live-immediate (see updatePublicPageSettingsAction).
    inquiryRecipientEmail:
      workspace.publicPage?.inquiryRecipientEmail || authUser?.email || "",
    siteIconUrl: portfolioSiteIconUrl(draft?.siteIcon),
    siteIconAssetId: draftFields.siteIconAssetId,
    // Seed seo sub-fields so the form shows existing draft values on load.
    // Both ends are tested: action tests verify persistence; form tests verify rendering.
    seo: {
      ogImageUrl: draftFields.seo.ogImageUrl,
      ogImageAssetId: draftFields.seo.ogImageAssetId,
      galleryDescription: draftFields.seo.galleryDescription,
      noindex: draftFields.seo.noindex,
    },
  };

  // Published-side snapshot in the same shape, so the frontend can recompute
  // pending-state client-side after a Save without a full reload.
  const publishedDefaults: PublicPageSettingsInput = {
    seoTitle: publishedFields.seoTitle,
    seoDescription: publishedFields.seoDescription,
    inquiryRecipientEmail:
      workspace.publicPage?.inquiryRecipientEmail || authUser?.email || "",
    siteIconUrl: portfolioSiteIconUrl(workspace.publicPage?.siteIcon),
    siteIconAssetId: publishedFields.siteIconAssetId,
    seo: {
      ogImageUrl: publishedFields.seo.ogImageUrl,
      ogImageAssetId: publishedFields.seo.ogImageAssetId,
      galleryDescription: publishedFields.seo.galleryDescription,
      noindex: publishedFields.seo.noindex,
    },
  };

  const t = await getTranslations("app.settings.tabs");
  const proPricing = await getProPricing(workspace.country ?? "PH");

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
              avatarAssetId={userDoc?.avatarAssetId ?? null}
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
          body: <WorkspaceBusinessForm defaults={businessDefaults} />,
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
              targetDraftId={String(draftId)}
              initialHasPendingChanges={initialHasPendingChanges}
              publishedDefaults={publishedDefaults}
              keywordsPending={keywordsPending}
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
              proPricing={proPricing}
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
