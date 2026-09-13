import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { listEntries } from "@/lib/content/entries";
import { editorialMetadata } from "@/lib/seo/metadata";
import { EditorialIndex } from "../_components/editorial-index";

export function generateMetadata(): Metadata {
  return editorialMetadata({
    path: "/compare",
    title: "CRM and Website Builder Alternatives for Creatives (2026)",
    description: "Compare 17hats, Dubsado, HoneyBook, Studio Ninja, Pixieset, Wix, Squarespace, Notion, Google Sheets, and Google Forms alternatives for event businesses.",
  });
}

export default function CompareIndexPage() {
  setRequestLocale("en");
  return <EditorialIndex entries={listEntries("compare")} activeKind="compare" />;
}
