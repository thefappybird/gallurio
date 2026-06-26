import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@measured/puck/rsc";
import { puckConfig } from "@/lib/page-builder/config";
import { buildRenderWorkspace, runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { getTranslations } from "next-intl/server";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { normalizePublicPageData } from "@/lib/page-builder/normalizePublicPageData";
import { ComingSoonFallback } from "../_components/ComingSoonFallback";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return {};

  const { publicPage, name } = workspace;
  const title = `${name} — Gallery`;
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
      canonical: `/w/${workspace.slug}/gallery`,
    },
    icons: iconUrl ? { icon: iconUrl } : undefined,
  };
}

export default async function PortfolioGalleryPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) notFound();

  // gallery data is stored as Schema.Types.Mixed; normalize before <Render> so
  // legacy/partial persisted data can't 500 the route (see the Home page note).
  const rawGallery = (workspace.publicPage?.data as { gallery?: unknown } | null | undefined)?.gallery;
  const galleryData = normalizePublicPageData(
    rawGallery,
    new Set(Object.keys(puckConfig.components)),
    "gallery"
  );

  const locale = resolvePublicChromeLocale(workspace);
  const t = await getTranslations({ locale, namespace: "publicPage.chrome" });

  if (!galleryData) {
    return (
      <ComingSoonFallback
        workspace={workspace}
        labels={{ comingSoon: t("comingSoon"), poweredBy: t("poweredBy") }}
      />
    );
  }

  const renderWorkspace = {
    ...buildRenderWorkspace(workspace),
    locale,
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

  return runWithRenderWorkspace(renderWorkspace, () => (
    // metadata threads workspace context to every block via props.puck.metadata —
    // the RSC-safe path (AsyncLocalStorage doesn't survive into async block render).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Render data={galleryData as any} config={puckConfig as any} metadata={{ workspace: renderWorkspace }} />
  ));
}
