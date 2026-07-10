"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { LocaleSwitcher } from "@/components/app/locale-switcher";

export function MarketingHeader() {
  const tNav = useTranslations("marketing.nav");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/brand/gallurio-sq.svg"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6"
            priority
          />
          <span className="font-heading text-base font-semibold tracking-tight">
            Gallurio
          </span>
        </Link>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <nav aria-label="Marketing" className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/pricing"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {tNav("pricing")}
            </Link>
            <Link
              href="/contact"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {tNav("contact")}
            </Link>
          </nav>

          <div className="flex items-center gap-1">
            <Link href="/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {tNav("signIn")}
            </Link>
            <Link href="/sign-up" className={buttonVariants({ variant: "brand", size: "sm" })}>
              {tNav("joinBeta")}
            </Link>
            <ThemeToggle variant="standalone" />
            <LocaleSwitcher variant="standalone" />
          </div>
        </div>
      </div>
    </header>
  );
}
