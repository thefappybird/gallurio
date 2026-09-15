import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { listEntries } from "@/lib/content/entries";
import { editorialMetadata } from "@/lib/seo/metadata";
import { EditorialIndex } from "../_components/editorial-index";

export function generateMetadata(): Metadata {
  return editorialMetadata({
    path: "/blog",
    title: "Event Business Guides: Pricing, Bookings and Clients (2026)",
    description: "Practical guides for event creatives on pricing photography packages, taking deposits, client onboarding, portfolio SEO, and booking operations.",
  });
}

export default function BlogIndexPage() {
  setRequestLocale("en");
  return <EditorialIndex entries={listEntries("blog")} activeKind="blog" />;
}
