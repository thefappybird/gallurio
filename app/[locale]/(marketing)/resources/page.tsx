import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { listEntries } from "@/lib/content/entries";
import { editorialMetadata } from "@/lib/seo/metadata";
import { EditorialIndex } from "../_components/editorial-index";

export function generateMetadata(): Metadata {
  return editorialMetadata({
    path: "/resources",
    title: "Event Business Software Guides and Alternatives (2026)",
    description: "Compare CRM and website-builder alternatives, then use practical guides for pricing, client onboarding, deposits, portfolios, and event bookings.",
  });
}

export default function ResourcesPage() {
  setRequestLocale("en");
  return <EditorialIndex entries={[...listEntries("blog"), ...listEntries("compare")]} />;
}
