"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export function MarketingFooter() {
  const tFooter = useTranslations("marketing.footer");

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
          <Link href="/pricing" className="hover:text-foreground">
            {tFooter("pricing")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {tFooter("terms")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {tFooter("privacy")}
          </Link>
          <Link href="/refunds" className="hover:text-foreground">
            {tFooter("refunds")}
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            {tFooter("contact")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
