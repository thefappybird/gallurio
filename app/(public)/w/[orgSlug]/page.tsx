import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@measured/puck/rsc";
import { puckConfig } from "@/lib/page-builder/config";
import { buildRenderWorkspace, runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { getTranslations } from "next-intl/server";
import { findPublishedWorkspaceBySlug, findPreviewSnapshot } from "@/lib/db/queries/publicPage";
import { normalizePublicPageData } from "@/lib/page-builder/normalizePublicPageData";
import { ComingSoonFallback } from "./_components/ComingSoonFallback";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ preview?: string }>;
};

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return {};

  const { publicPage, branding, name } = workspace;

  const title = publicPage?.seoTitle || name;
  const description = publicPage?.seoDescription || branding?.tagline || undefined;
  const logoUrl =
    typeof branding?.logoUrl === "string" && branding.logoUrl ? branding.logoUrl : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description: description ?? "",
      images: logoUrl ? [{ url: logoUrl }] : undefined,
    },
    alternates: {
      canonical: `/w/${workspace.slug}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortfolioHomePage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const { preview: previewToken } = (await searchParams) ?? {};

  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) notFound();

  // If a preview token is present, look up the short-lived snapshot. Falls back
  // to published data on unknown/expired tokens so stale links degrade gracefully.
  const snapshot = previewToken
    ? (await findPreviewSnapshot(previewToken, String(workspace._id))) as { data?: { home?: unknown } } | null
    : null;

  // publicPage is guaranteed non-null here — the query filters on publishedAt != null.
  // homeData is stored as Schema.Types.Mixed (raw `unknown` from the lean doc).
  // Normalize it before <Render>: Puck's RSC renderer assumes a well-formed Data
  // object (it does `'props' in data.root` with no defaulting), so legacy/partial
  // persisted data would 500 the whole route. null -> show the ComingSoon fallback.
  const rawHome = snapshot
    ? (snapshot.data as { home?: unknown } | null | undefined)?.home
    : (workspace.publicPage?.data as { home?: unknown } | null | undefined)?.home;

  const homeData = normalizePublicPageData(
    rawHome,
    new Set(Object.keys(puckConfig.components)),
    "home"
  );

  // Derive chrome locale from workspace country and resolve translated strings
  // at the page boundary so blocks stay synchronous and unit-testable.
  const locale = resolvePublicChromeLocale(workspace);
  const t = await getTranslations({ locale, namespace: "publicPage.chrome" });

  // ComingSoonFallback does not need workspace block context — only <Render>
  // (and the blocks it invokes) reads the AsyncLocalStorage store.
  if (!homeData) {
    return (
      <ComingSoonFallback
        workspace={workspace}
        labels={{ comingSoon: t("comingSoon"), poweredBy: t("poweredBy") }}
      />
    );
  }

  // buildRenderWorkspace copies workspace-level fields (branding, contact, etc.).
  // When rendering a preview snapshot, block content (data.home) is swapped above,
  // but brand colors, contact config, and header still reflect the published workspace.
  // TODO: apply snapshot.brandKit / snapshot.contact / snapshot.header to renderWorkspace
  // so theme and config changes are also visible in the new-tab preview.
  const renderWorkspace = {
    ...buildRenderWorkspace(workspace),
    editorPreview: !!snapshot,
    locale,
    // Pass the ICU template with "{price}" preserved for per-item substitution
    // in ServicesListBlock — ICU substitutes price: "{price}" → literal token.
    chrome: {
      startingFrom: t("startingFrom", { price: "{price}" }),
      gallery: {
        empty: t("gallery.empty"),
        noCollection: t("gallery.noCollection"),
        unavailable: t("gallery.unavailable"),
        error: t("gallery.error"),
        featuredEmpty: t("gallery.featuredEmpty"),
        carouselHint: t("gallery.carouselHint"),
        carouselPrev: t("gallery.carouselPrev"),
        carouselNext: t("gallery.carouselNext"),
      },
    },
  };

  // runWithRenderWorkspace gives every server block rendered inside this tree
  // an isolated, request-scoped store. Concurrent requests cannot clobber
  // each other's workspace context (unlike a module-level singleton).
  return runWithRenderWorkspace(renderWorkspace, () => (
    // metadata threads workspace context to every block via props.puck.metadata —
    // the RSC-safe path (AsyncLocalStorage doesn't survive into async block render).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Render data={homeData as any} config={puckConfig as any} metadata={{ workspace: renderWorkspace }} />
  ));
}
