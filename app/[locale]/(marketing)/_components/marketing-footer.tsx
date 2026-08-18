"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export function MarketingFooter() {
  const tFooter = useTranslations("marketing.footer");
  const tAppInfo = useTranslations("marketing.appInfo");
  const tTerms = useTranslations("marketing.terms");
  const tPrivacy = useTranslations("marketing.privacy");

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
            {tFooter("portfolioMaker")}
          </Link>
          <Link href="/about" className="hover:text-foreground">
            {tAppInfo("navigationLabel")}
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            {tFooter("pricing")}
          </Link>
          <Link href="/compare" className="hover:text-foreground">
            {tFooter("comparisons")}
          </Link>
          <Link href="/blog" className="hover:text-foreground">
            {tFooter("writing")}
          </Link>
          <Link href="/book-demo" className="hover:text-foreground">
            {tFooter("bookDemo")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {tTerms("title")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {tPrivacy("title")}
          </Link>
          <Link href="/refunds" className="hover:text-foreground">
            {tFooter("refundPolicy")}
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            {tFooter("contact")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
