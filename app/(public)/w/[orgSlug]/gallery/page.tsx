import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@measured/puck/rsc";
import { puckConfig } from "@/lib/page-builder/config";
import { buildRenderWorkspace, runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { localeForCountry } from "@/lib/i18n/localeForCountry";
import { getTranslations } from "next-intl/server";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { ComingSoonFallback } from "../_components/ComingSoonFallback";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return {};

  const { publicPage, branding, name } = workspace;
  const title = `${name} — Gallery`;
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
      canonical: `/w/${workspace.slug}/gallery`,
    },
  };
}

export default async function PortfolioGalleryPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) notFound();

  // gallery data is stored as Schema.Types.Mixed; same any-escape as the Home page.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const galleryData: any =
    (workspace.publicPage?.data as { gallery?: unknown } | null | undefined)?.gallery ?? null;

  const locale = localeForCountry(workspace.country);
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
    chrome: { startingFrom: t("startingFrom", { price: "{price}" }) },
  };

  return runWithRenderWorkspace(renderWorkspace, () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Render data={galleryData} config={puckConfig as any} />
  ));
}
