import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { requireOrg } from "@/lib/auth/requireOrg";
import { routing } from "@/lib/i18n/routing";
import { DEFAULT_BRAND_KIT, DEFAULT_HEADER_CONFIG, type PortfolioBrandKit, type PortfolioCollectionsPopupConfig, type PortfolioContactConfig, type PortfolioHeaderConfig, type PortfolioSavedTheme, type PuckData } from "@/lib/page-builder/types";
import { PORTFOLIO_TEMPLATES } from "@/lib/page-builder/templates";
import { seedDefaultPortfolio } from "@/lib/page-builder/seedPortfolio";
import { reconcileGalleryImages, reconcileFeaturedCollections } from "@/lib/page-builder/reconcile";
import { EditorShell, type EditorTemplateSummary } from "./_components/EditorShell";
import { ensureLegacyDraftMigrated } from "@/lib/page-builder/migrateDraft";
import { listDraftsAction } from "./_draftActions";
import { DEFAULT_DRAFT_NAME } from "@/lib/page-builder/drafts";
import { portfolioHeaderLogoUrl } from "@/lib/storage/portfolioAssetUrls";
import { PortfolioDraft } from "@/lib/db/models";

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

const EMPTY_ZONE: PuckData = { content: [], root: {} };

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

  // First visit (no seeded home) → seed the closest starter template inline so
  // the editor opens on a real page (the wizard is gone; the guide overlay and
  // template switcher take its place). Idempotent + race-safe.
  let homeData: unknown = pp?.data?.home ?? null;
  let galleryData: unknown = pp?.data?.gallery ?? null;
  let brandKitData: unknown = pp?.brandKit ?? null;
  let contactData: unknown = pp?.contact ?? null;
  let templateId: string = pp?.templateId ?? "scratch";
  if (!homeData) {
    const seed = await seedDefaultPortfolio(workspace._id);
    if (seed) {
      homeData = seed.data.home;
      galleryData = seed.data.gallery;
      brandKitData = seed.brandKit;
      contactData = seed.contact;
      templateId = seed.templateId;
    }
  }

  const workspaceId = String(workspace._id);
  const reconcileZone = async (raw: unknown) =>
    reconcileFeaturedCollections(workspaceId, await reconcileGalleryImages(workspaceId, toPlain<PuckData>(raw, EMPTY_ZONE)));
  const initialData = {
    home: await reconcileZone(homeData),
    gallery: await reconcileZone(galleryData),
  };
  const initialBrandKit = toPlain<PortfolioBrandKit>(brandKitData, DEFAULT_BRAND_KIT);
  const initialContact = toPlain<PortfolioContactConfig>(contactData, {});
  const rawInitialHeaderConfig = toPlain<PortfolioHeaderConfig>(pp?.header ?? null, DEFAULT_HEADER_CONFIG);
  const initialHeaderConfig = {
    ...rawInitialHeaderConfig,
    logoUrl: portfolioHeaderLogoUrl({
      url: rawInitialHeaderConfig.logoUrl,
      assetId: rawInitialHeaderConfig.logoAssetId,
    }),
  };
  const initialCollectionsPopup = toPlain<PortfolioCollectionsPopupConfig>(pp?.collectionsPopup ?? null, {});
  const initialFormLocale = toPlain<string>(pp?.formLocale, "");
  const initialFormDir = toPlain<string>(pp?.formDir, "");
  const guideDismissed = Boolean(pp?.guideDismissedAt);
  const initialSavedThemes = toPlain<PortfolioSavedTheme[]>(pp?.savedThemes, []);
  const storyPromptCompleted = Boolean(pp?.storyPromptCompletedAt);
  const workspaceBusinessType = workspace.businessType ?? "";

  // Migrate legacy publicPage.data into a draft if this workspace has no drafts yet.
  await ensureLegacyDraftMigrated(workspace._id);
  const initialDrafts = await listDraftsAction();
  // First-paint active draft = newest (migrated/most recent). The client entry
  // chooser lets the owner pick differently.
  const activeDraft = initialDrafts[0] ?? null;
  const initialActiveDraftId = activeDraft?.id ?? null;
  const initialActiveDraftName = activeDraft?.name ?? DEFAULT_DRAFT_NAME;

  // Bundled SEO fields (description/keywords) now live on the active draft, not
  // the stale published publicPage — read from the resolved active draft so a
  // page reload reflects the last save instead of reverting to live values.
  const activeDraftSeo = initialActiveDraftId
    ? await PortfolioDraft.findOne(
        { _id: initialActiveDraftId },
        { seoDescription: 1, "seo.keywords": 1 },
      ).lean()
    : null;
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
