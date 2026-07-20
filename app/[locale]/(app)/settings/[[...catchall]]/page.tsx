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
import { User, type PlanTier } from "@/lib/db/models";
import { resolveActiveDraftId } from "@/lib/page-builder/activeDraft";
import {
  normalizeSettingsSeoFields,
  hasPendingSettingsSeoChanges,
} from "@/lib/portfolio/publicPageSeoFields";
import { SettingsUserProfile } from "../_components/settings-user-profile";
import { WorkspaceBusinessForm } from "../workspace/_business-form";
import { CustomizePanel } from "../customize/_panel";
import { PublicPageSettingsForm } from "../public-page/_form";
import { DevPlanPanel } from "../dev-plan/_panel";
import { BillingPanel } from "../billing/_panel";
import { getProPricing } from "@/lib/lemonsqueezy/pricing";
import { isPaidBillingAvailable } from "@/lib/billing/availability";
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

  const businessDefaults: UpdateWorkspaceBusinessInput = {
    name: workspace.name,
    slug: workspace.slug,
    businessType:
      workspace.businessType as UpdateWorkspaceBusinessInput["businessType"],
    businessTypeOther: workspace.businessTypeOther ?? "",
    country: (workspace.country ?? "PH") as SupportedCountry,
    currency: workspace.currency as SupportedCurrency,
    timezone: workspace.timezone ?? "Asia/Manila",
    contactEmail: workspace.contact?.email ?? "",
    contactAddress: workspace.contact?.address ?? "",
    contactAddressLat: workspace.contact?.addressLat ?? null,
    contactAddressLng: workspace.contact?.addressLng ?? null,
    logoUrl: workspace.logoUrl ?? "",
    logoAssetId: workspace.logoAssetId ?? "",
  };

  const draftId = await resolveActiveDraftId(workspace._id);
  const settingsDraftFields = normalizeSettingsSeoFields(
    workspace.publicPage?.settingsDraft ?? workspace.publicPage
  );
  const publishedFields = normalizeSettingsSeoFields(workspace.publicPage);
  const initialHasPendingChanges =
    hasPendingSettingsSeoChanges(settingsDraftFields, publishedFields);

  // Logo isn't part of the shared normalizeSettingsSeoFields shape (that
  // helper is also used for pending-change diffing elsewhere) — read it
  // directly here, same draft-buffer-falls-back-to-live pattern as siteIcon.
  // settingsDraft.logo uses {url,assetId} (matching siteIcon); the live
  // header uses {logoUrl,logoAssetId} — field names differ, so map explicitly
  // rather than falling back to the whole object. settingsDraft.logo
  // defaults to {url:"",assetId:""} once the settingsDraft subdocument
  // exists at all (e.g. after any unrelated SEO save) — a field-level `??`
  // on url/assetId individually can't detect that "empty" case since "" is
  // neither null nor undefined, so assetId truthiness gates the whole pair.
  const draftLogoSource = workspace.publicPage?.settingsDraft?.logo;
  const hasDraftLogo = !!draftLogoSource?.assetId;
  const draftLogoUrl = hasDraftLogo
    ? draftLogoSource!.url ?? ""
    : workspace.publicPage?.header?.logoUrl ?? "";
  const draftLogoAssetId = hasDraftLogo
    ? draftLogoSource!.assetId ?? ""
    : workspace.publicPage?.header?.logoAssetId ?? "";

  const publicPageDefaults: PublicPageSettingsInput = {
    seoTitle: settingsDraftFields.seoTitle,
    seoDescription: settingsDraftFields.seoDescription,
    // Default inquiry routing to the owner's own email until they set another.
    // This field alone stays live-immediate (see updatePublicPageSettingsAction).
    inquiryRecipientEmail:
      workspace.publicPage?.inquiryRecipientEmail || authUser?.email || "",
    logoUrl: draftLogoUrl,
    logoAssetId: draftLogoAssetId,
    siteIconUrl: portfolioSiteIconUrl(
      workspace.publicPage?.settingsDraft?.siteIcon ?? workspace.publicPage?.siteIcon
    ),
    siteIconAssetId: settingsDraftFields.siteIconAssetId,
    seo: {
      keywords: settingsDraftFields.seo.keywords,
      ogImageUrl: settingsDraftFields.seo.ogImageUrl,
      ogImageAssetId: settingsDraftFields.seo.ogImageAssetId,
      galleryDescription: settingsDraftFields.seo.galleryDescription,
      noindex: settingsDraftFields.seo.noindex,
    },
  };

  // Published-side snapshot in the same shape, so the frontend can recompute
  // pending-state client-side after a Save without a full reload.
  const publishedDefaults: PublicPageSettingsInput = {
    seoTitle: publishedFields.seoTitle,
    seoDescription: publishedFields.seoDescription,
    inquiryRecipientEmail:
      workspace.publicPage?.inquiryRecipientEmail || authUser?.email || "",
    logoUrl: workspace.publicPage?.header?.logoUrl ?? "",
    logoAssetId: workspace.publicPage?.header?.logoAssetId ?? "",
    siteIconUrl: portfolioSiteIconUrl(workspace.publicPage?.siteIcon),
    siteIconAssetId: publishedFields.siteIconAssetId,
    seo: {
      keywords: publishedFields.seo.keywords,
      ogImageUrl: publishedFields.seo.ogImageUrl,
      ogImageAssetId: publishedFields.seo.ogImageAssetId,
      galleryDescription: publishedFields.seo.galleryDescription,
      noindex: publishedFields.seo.noindex,
    },
  };

  const t = await getTranslations("app.settings.tabs");
  const proPricing = await getProPricing();

  // Active slug: null means base /settings -> render account tab
  const activeSlug = slug;

  return (
    <SettingsUserProfile
      role={role}
      activeSlug={activeSlug ?? "account"}
      workspaceName={workspace.name}
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
              currentPlan={workspace.plan as PlanTier}
              lsSubscriptionStatus={
                (workspace.lsSubscriptionStatus as
                  | "active"
                  | "canceled"
                  | "past_due"
                  | "paused"
                  | "trialing"
                  | null) ?? null
              }
              lsCurrentPeriodEnd={workspace.lsCurrentPeriodEnd ?? null}
              workspaceId={String(workspace._id)}
              customerEmail={authUser?.email ?? ""}
              proPricing={proPricing}
              billingAvailable={isPaidBillingAvailable()}
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
                    currentPlan={workspace.plan as PlanTier}
                  />
                ),
              },
            ] as const)
          : []),
      ]}
    />
  );
}
