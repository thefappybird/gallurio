import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@measured/puck/rsc";
import { puckConfig } from "@/lib/page-builder/config";
import { buildRenderWorkspace, runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { localeForCountry } from "@/lib/i18n/localeForCountry";
import { getTranslations } from "next-intl/server";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
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

export default async function PortfolioHomePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) notFound();

  // publicPage is guaranteed non-null here — the query filters on publishedAt != null.
  // homeData is stored as Schema.Types.Mixed. The raw Mongoose lean doc gives us `unknown`,
  // and puckConfig.components is typed with our specific Components union, which creates
  // a Data<Components> vs Data<DefaultComponents> mismatch at the Render call site.
  // We escape with `any` — the shape is correct at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const homeData: any =
    ((workspace.publicPage?.data as { home?: unknown } | null | undefined)?.home) ?? null;

  // Derive chrome locale from workspace country and resolve translated strings
  // at the page boundary so blocks stay synchronous and unit-testable.
  const locale = localeForCountry(workspace.country);
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

  // buildRenderWorkspace copies all fields (including contact) from the DB doc
  // into the render context — preventing silent omissions at this boundary.
  const renderWorkspace = {
    ...buildRenderWorkspace(workspace),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Render data={homeData} config={puckConfig as any} />
  ));
}
