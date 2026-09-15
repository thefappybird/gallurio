import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { listEntries } from "@/lib/content/entries";
import { editorialMetadata, localeUrl } from "@/lib/seo/metadata";
import { buildCollectionPageLd } from "@/lib/seo/marketingJsonLd";
import { safeJsonLd } from "@/lib/page-builder/seo/jsonLd";
import { EditorialIndex } from "../_components/editorial-index";

const TITLE = "CRM and Website Builder Alternatives for Creatives (2026)";
const DESCRIPTION =
  "Compare 17hats, Dubsado, HoneyBook, Studio Ninja, Pixieset, Wix, Squarespace, Notion, Google Sheets, and Google Forms alternatives for event businesses.";

export function generateMetadata(): Metadata {
  return editorialMetadata({
    path: "/compare",
    title: TITLE,
    description: DESCRIPTION,
  });
}

export default function CompareIndexPage() {
  setRequestLocale("en");
  const entries = listEntries("compare");
  const collectionPageLd = buildCollectionPageLd({
    url: localeUrl("en", "/compare"),
    name: TITLE,
    description: DESCRIPTION,
    items: entries.map((entry) => ({ name: entry.title, url: localeUrl("en", `/compare/${entry.slug}`) })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionPageLd) }} />
      <EditorialIndex entries={entries} activeKind="compare" />
    </>
  );
}
