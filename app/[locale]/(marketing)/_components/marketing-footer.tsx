"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { isEditorialRoute } from "./editorial-route";

const ENGLISH_FOOTER = {
  portfolioMaker: "Portfolio Builder",
  about: "About",
  pricing: "Pricing",
  resources: "Resources",
  bookDemo: "Book a Demo",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  refunds: "Refund Policy",
  contact: "Contact",
} as const;

export function MarketingFooter() {
  const tFooter = useTranslations("marketing.footer");
  const tAppInfo = useTranslations("marketing.appInfo");
  const tTerms = useTranslations("marketing.terms");
  const tPrivacy = useTranslations("marketing.privacy");
  const pathname = usePathname();
  const englishOnly = isEditorialRoute(pathname);

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/gallurio-sq.svg"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5"
          />
          <span className="font-heading text-sm font-semibold">Gallurio</span>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
        >
          <Link href="/portfolio-maker-demo" className="hover:text-foreground">
            {englishOnly ? ENGLISH_FOOTER.portfolioMaker : tFooter("portfolioMaker")}
          </Link>
          <Link href="/about" className="hover:text-foreground">
            {englishOnly ? ENGLISH_FOOTER.about : tAppInfo("navigationLabel")}
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            {englishOnly ? ENGLISH_FOOTER.pricing : tFooter("pricing")}
          </Link>
          <Link href="/resources" className="hover:text-foreground">
            {englishOnly ? ENGLISH_FOOTER.resources : tFooter("resources")}
          </Link>
          <Link href="/book-demo" className="hover:text-foreground">
            {englishOnly ? ENGLISH_FOOTER.bookDemo : tFooter("bookDemo")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {englishOnly ? ENGLISH_FOOTER.terms : tTerms("title")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {englishOnly ? ENGLISH_FOOTER.privacy : tPrivacy("title")}
          </Link>
          <Link href="/refunds" className="hover:text-foreground">
            {englishOnly ? ENGLISH_FOOTER.refunds : tFooter("refundPolicy")}
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            {englishOnly ? ENGLISH_FOOTER.contact : tFooter("contact")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
