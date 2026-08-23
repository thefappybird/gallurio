import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { listEntries } from "@/lib/content/entries";
import { editorialMetadata } from "@/lib/seo/metadata";
import { EditorialIndex } from "../_components/editorial-index";

export function generateMetadata(): Metadata {
  return editorialMetadata({
    path: "/blog",
    title: "Guides for event businesses | Gallurio",
    description: "Practical English-language guides to pricing, client intake, portfolio decisions, deposits, and event-business operations.",
  });
}

export default function BlogIndexPage() {
  setRequestLocale("en");
  return <EditorialIndex entries={listEntries("blog")} activeKind="blog" />;
}
