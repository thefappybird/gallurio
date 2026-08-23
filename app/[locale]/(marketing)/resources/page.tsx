import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { listEntries } from "@/lib/content/entries";
import { editorialMetadata } from "@/lib/seo/metadata";
import { EditorialIndex } from "../_components/editorial-index";

export function generateMetadata(): Metadata {
  return editorialMetadata({
    path: "/resources",
    title: "Resources for event businesses | Gallurio",
    description: "Practical guides and honest software comparisons for photographers, planners, caterers, venues, and other event businesses.",
  });
}

export default function ResourcesPage() {
  setRequestLocale("en");
  return <EditorialIndex entries={[...listEntries("blog"), ...listEntries("compare")]} />;
}
