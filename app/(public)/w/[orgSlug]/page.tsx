import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@measured/puck/rsc";
import { puckConfig } from "@/lib/page-builder/config";
import { buildRenderWorkspace, runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { getTranslations } from "next-intl/server";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { normalizePublicPageData } from "@/lib/page-builder/normalizePublicPageData";
import { ComingSoonFallback } from "./_components/ComingSoonFallback";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return {};

  const { publicPage, name } = workspace;

  const title = publicPage?.seoTitle || name;
  const description = publicPage?.seoDescription || undefined;
  const iconUrl = workspace.publicPage?.siteIcon?.url || workspace.publicPage?.header?.logoUrl;

  return {
    title,
    description,
    openGraph: {
      title,
      description: description ?? "",
    },
    alternates: {
      canonical: `/w/${workspace.slug}`,
    },
    icons: iconUrl ? { icon: iconUrl } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortfolioHomePage({ params }: PageProps) {
  const { orgSlug } = await params;

  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) notFound();

  // publicPage is guaranteed non-null here — the query filters on publishedAt != null.
  // homeData is stored as Schema.Types.Mixed (raw `unknown` from the lean doc).
  // Normalize it before <Render>: Puck's RSC renderer assumes a well-formed Data
  // object (it does `'props' in data.root` with no defaulting), so legacy/partial
  // persisted data would 500 the whole route. null -> show the ComingSoon fallback.
  const rawHome = (workspace.publicPage?.data as { home?: unknown } | null | undefined)?.home;

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

  // buildRenderWorkspace copies workspace-level fields (contact, etc.).
  const renderWorkspace = {
    ...buildRenderWorkspace(workspace),
    locale,
    // Pass the ICU template with "{price}" preserved for per-item substitution
    // in ServicesListBlock — ICU substitutes price: "{price}" → literal token.
    chrome: {
      startingFrom: t("startingFrom", { price: "{price}" }),
      socialLinkConfirm: t("socialLinkConfirm", { url: "{url}" }),
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
