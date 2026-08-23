import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { listEntries } from "@/lib/content/entries";
import { editorialMetadata } from "@/lib/seo/metadata";
import { EditorialIndex } from "../_components/editorial-index";

export function generateMetadata(): Metadata {
  return editorialMetadata({
    path: "/compare",
    title: "Gallurio software comparisons",
    description: "Honest English-language comparisons between Gallurio and the CRM, website, gallery, spreadsheet, and intake tools event businesses use today.",
  });
}

export default function CompareIndexPage() {
  setRequestLocale("en");
  return <EditorialIndex entries={listEntries("compare")} activeKind="compare" />;
}
