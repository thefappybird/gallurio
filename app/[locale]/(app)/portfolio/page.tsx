import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { requireOrg } from "@/lib/auth/requireOrg";
import { routing } from "@/lib/i18n/routing";
import { DEFAULT_BRAND_KIT, DEFAULT_HEADER_CONFIG, type PortfolioBrandKit, type PortfolioCollectionsPopupConfig, type PortfolioContactConfig, type PortfolioHeaderConfig, type PortfolioSavedTheme, type PuckData } from "@/lib/page-builder/types";
import { PORTFOLIO_TEMPLATES } from "@/lib/page-builder/templates";
import { reconcileGalleryImages, reconcileFeaturedCollections } from "@/lib/page-builder/reconcile";
import { EditorShell, type EditorTemplateSummary } from "./_components/EditorShell";
import { ensureLegacyDraftMigrated } from "@/lib/page-builder/migrateDraft";
import { listDraftsAction } from "./_draftActions";
import { DEFAULT_DRAFT_NAME } from "@/lib/page-builder/drafts";
import { portfolioHeaderLogoUrl } from "@/lib/storage/portfolioAssetUrls";
import { portfolioBaseDomain } from "@/lib/portfolio/publicUrl";
import { PortfolioDraft } from "@/lib/db/models";
import { normalizeSharedChromeData, readNavigationConfig } from "@/lib/page-builder/sharedChrome";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.pageBuilder");
  return { title: t("title") };
}

// Strip to plain, serializable JSON before crossing the server→client boundary.
function toPlain<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return fallback;
  }
}

export default async function PageBuilderEntry({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.pageBuilder");

  const { workspace, role } = await requireOrg();

  if (role !== "owner") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ownerOnly")}</p>
      </div>
    );
  }

  const pp = workspace.publicPage;

  // Resolve durable work before considering published content or a scratch
  // seed. Draft summaries are ordered by updatedAt descending.
  await ensureLegacyDraftMigrated(workspace._id);
  const initialDrafts = await listDraftsAction();
  const activeDraft = initialDrafts[0] ?? null;
  const initialActiveDraftId = activeDraft?.id ?? null;
  const initialActiveDraftName = activeDraft?.name ?? DEFAULT_DRAFT_NAME;
  const activeDraftDoc = initialActiveDraftId
    ? await PortfolioDraft.findOne({ _id: initialActiveDraftId, workspaceId: workspace._id }).lean()
    : null;

  // With no durable draft, published content is the fallback. If neither
  // exists, normalization below supplies a genuine empty scratch document.
  const homeData: unknown = pp?.data?.home ?? null;
  const galleryData: unknown = pp?.data?.gallery ?? null;
  const brandKitData: unknown = pp?.brandKit ?? null;
  const contactData: unknown = pp?.contact ?? null;
  let templateId: string = pp?.templateId ?? "scratch";

  const workspaceId = String(workspace._id);
  const guideDismissed = Boolean(pp?.guideDismissedAt);
  const initialSavedThemes = toPlain<PortfolioSavedTheme[]>(pp?.savedThemes, []);
  const storyPromptCompleted = Boolean(pp?.storyPromptCompletedAt);
  const workspaceBusinessType = workspace.businessType ?? "";

  const durableOrPublishedData = normalizeSharedChromeData(
    {
      home: toPlain<PuckData | null>(activeDraftDoc?.data?.home, null) ?? toPlain<PuckData | null>(homeData, null),
      gallery: toPlain<PuckData | null>(activeDraftDoc?.data?.gallery, null) ?? toPlain<PuckData | null>(galleryData, null),
      navigation:
        toPlain<PuckData | null>(activeDraftDoc?.data?.navigation, null) ??
        toPlain<PuckData | null>(pp?.data?.navigation, null),
      footer:
        toPlain<PuckData | null>(activeDraftDoc?.data?.footer, null) ??
        toPlain<PuckData | null>(pp?.data?.footer, null),
    },
    toPlain<PortfolioHeaderConfig>(activeDraftDoc?.header ?? pp?.header, DEFAULT_HEADER_CONFIG),
  );
  const reconcileZone = async (raw: PuckData) =>
    reconcileFeaturedCollections(workspaceId, await reconcileGalleryImages(workspaceId, raw));
  const initialData = {
    home: await reconcileZone(durableOrPublishedData.home),
    gallery: await reconcileZone(durableOrPublishedData.gallery),
    navigation: durableOrPublishedData.navigation,
    footer: await reconcileZone(durableOrPublishedData.footer),
  };
  const initialBrandKit = toPlain<PortfolioBrandKit>(activeDraftDoc?.brandKit ?? brandKitData, DEFAULT_BRAND_KIT);
  const initialContact = toPlain<PortfolioContactConfig>(activeDraftDoc?.contact ?? contactData, {});
  const rawInitialHeaderConfig = readNavigationConfig(
    initialData.navigation,
    toPlain<PortfolioHeaderConfig>(activeDraftDoc?.header ?? pp?.header, DEFAULT_HEADER_CONFIG),
  );
  const initialHeaderConfig = {
    ...rawInitialHeaderConfig,
    logoUrl: portfolioHeaderLogoUrl({
      url: rawInitialHeaderConfig.logoUrl,
      assetId: rawInitialHeaderConfig.logoAssetId,
    }),
  };
  const initialCollectionsPopup = toPlain<PortfolioCollectionsPopupConfig>(
    activeDraftDoc?.collectionsPopup ?? pp?.collectionsPopup,
    {},
  );
  const initialFormLocale = toPlain<string>(activeDraftDoc?.formLocale ?? pp?.formLocale, "");
  const initialFormDir = toPlain<string>(activeDraftDoc?.formDir ?? pp?.formDir, "");
  templateId = activeDraftDoc?.templateId || templateId;

  // Bundled SEO fields (description/keywords) now live on the active draft, not
  // the stale published publicPage — read from the resolved active draft so a
  // page reload reflects the last save instead of reverting to live values.
  const activeDraftSeo = activeDraftDoc;
  const initialSeoDescription = activeDraftSeo?.seoDescription ?? "";
  const initialSeoKeywords = toPlain<string[]>(activeDraftSeo?.seo?.keywords, []);

  // Serializable starter-template summaries for the in-editor switcher.
  const templates: EditorTemplateSummary[] = PORTFOLIO_TEMPLATES.map((tpl) => ({
    id: tpl.id,
    label: tpl.label,
    description: tpl.description,
    defaultBrandKit: toPlain(tpl.defaultBrandKit, DEFAULT_BRAND_KIT),
  }));
  const publicOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const portfolioDomain = portfolioBaseDomain();
  // Locale-aware path to the chrome-less preview route (loaded in an iframe).
  // English has no prefix under localePrefix: "as-needed".
  const previewBasePath =
    locale === routing.defaultLocale ? "/portfolio-preview" : `/${locale}/portfolio-preview`;

  // Full-bleed editor: `-m-6` cancels the app shell's `<main>` padding so the
  // editor fills the whole content area, and `h-svh` pins it to the viewport.
  // Horizontal overflow remains scrollable so the desktop editor is still usable
  // on constrained screens.
  return (
    <div className="-m-6 h-svh overflow-x-auto">
      <EditorShell
        slug={workspace.slug}
        workspaceName={workspace.name}
        initialData={initialData}
        initialBrandKit={initialBrandKit}
        initialContact={initialContact}
        initialFormLocale={initialFormLocale}
        initialFormDir={initialFormDir}
        initialHeaderConfig={initialHeaderConfig}
        initialCollectionsPopup={initialCollectionsPopup}
        publicOrigin={publicOrigin}
        portfolioDomain={portfolioDomain}
        previewBasePath={previewBasePath}
        templates={templates}
        currentTemplateId={templateId}
        guideDismissed={guideDismissed}
        initialSavedThemes={initialSavedThemes}
        storyPromptCompleted={storyPromptCompleted}
        initialSeoDescription={initialSeoDescription}
        initialSeoKeywords={initialSeoKeywords}
        initialInquiryRecipientEmail={pp?.inquiryRecipientEmail ?? ""}
        hasBeenPublished={Boolean(pp?.publishedAt)}
        workspaceBusinessType={workspaceBusinessType}
        initialDrafts={initialDrafts}
        initialActiveDraftId={initialActiveDraftId}
        initialActiveDraftName={initialActiveDraftName}
      />
    </div>
  );
}
