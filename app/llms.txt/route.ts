import { listEntries } from "@/lib/content/entries";
import { getProPricing } from "@/lib/lemonsqueezy/pricing";
import { formatMoney } from "@/lib/utils/format-currency";

// Node runtime: reads content off disk and the live price from Lemon Squeezy.
export const runtime = "nodejs";

// /llms.txt is the convention for telling language-model crawlers what a site
// is and where its substantive pages are, in one plain-text file they can read
// without executing anything. The page list is generated from the same content
// index the sitemap uses, so the two cannot drift apart.
export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pricing = await getProPricing();
  const monthly = formatMoney(pricing.monthly, pricing.currency, "en");
  const yearly = formatMoney(pricing.yearly, pricing.currency, "en");

  const section = (heading: string, lines: string[]) =>
    lines.length ? [`## ${heading}`, "", ...lines, ""].join("\n") : "";

  const link = (path: string, title: string, note: string) =>
    `- [${title}](${base}${path}): ${note}`;

  const body = [
    "# Gallurio",
    "",
    "> Gallurio is a CRM for event businesses — photographers, planners, caterers,",
    "> venues and DJs. One workspace holds bookings, clients, a calendar, invoice",
    "> PDFs, and a public portfolio page whose contact form turns an enquiry into a",
    "> client and a booking in a single transaction.",
    "",
    `Pricing: one plan at ${monthly} per month or ${yearly} per year, billed in`,
    `${pricing.currency} and shown to visitors converted into their own currency.`,
    "There is no higher tier. New workspaces get one month of the full plan free.",
    "",
    section("Product", [
      link("/", "Home", "what Gallurio does"),
      link("/pricing", "Pricing", "the single plan and what it includes"),
      link("/about", "About", "who builds it"),
      link("/contact", "Contact", "how to reach support"),
      link("/book-demo", "Book a demo", "a walkthrough with a person"),
    ]),
    section(
      "Comparisons",
      listEntries("compare").map((entry) =>
        link(`/compare/${entry.slug}`, entry.title, entry.description)
      )
    ),
    section(
      "Writing",
      listEntries("blog").map((entry) => link(`/blog/${entry.slug}`, entry.title, entry.description))
    ),
    section("Policies", [
      link("/privacy", "Privacy policy", "what data is held and why"),
      link("/terms", "Terms", "terms of service"),
      link("/refunds", "Refunds", "refund policy"),
    ]),
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Content changes only on deploy; a short cache keeps crawlers cheap
      // without making a correction wait a day to appear.
      "cache-control": "public, max-age=3600",
    },
  });
}
