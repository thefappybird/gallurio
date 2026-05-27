import type { Metadata } from "next";
import type { Data } from "@measured/puck";
import { notFound } from "next/navigation";
import { Render } from "@measured/puck/rsc";
import { puckConfig } from "@/lib/page-builder";
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
  // homeData is stored as Schema.Types.Mixed so we cast to Data for Puck's Render.
  const homeData =
    ((workspace.publicPage?.data as { home?: unknown } | null | undefined)?.home as Data) ??
    null;

  return homeData ? (
    <Render data={homeData} config={puckConfig} />
  ) : (
    <ComingSoonFallback workspace={workspace} />
  );
}
