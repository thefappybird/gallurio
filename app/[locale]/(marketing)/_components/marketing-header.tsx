"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { MenuIcon } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MarketingHeader() {
  const tNav = useTranslations("marketing.nav");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
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

        <div className="hidden flex-1 items-center justify-end gap-x-4 gap-y-2 sm:flex">
          <nav aria-label="Marketing" className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/pricing"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {tNav("pricing")}
            </Link>
            <Link
              href="/portfolio-maker"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {tNav("portfolioMaker")}
            </Link>
            <Link
              href="/book-demo"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {tNav("bookDemo")}
            </Link>
            <Link
              href="/contact"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {tNav("contact")}
            </Link>
          </nav>

          <div className="flex items-center gap-1 gap-x-4">
            <Link href="/sign-in" className="flex items-center gap-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {tNav("signIn")}
            </Link>
            <Link href="/sign-up" className={buttonVariants({ variant: "brand", size: "sm" })}>
              {tNav("getStarted")}
            </Link>
            <ThemeToggle variant="standalone" />
            <Suspense fallback={<div className="size-9" />}>
              <LocaleSwitcher variant="standalone" />
            </Suspense>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:hidden">
          <Link
            href="/sign-up"
            className={buttonVariants({ variant: "brand", size: "sm", className: "whitespace-nowrap" })}
          >
            {tNav("getStarted")}
          </Link>
          <Sheet>
            <SheetTrigger
              aria-label="Open menu"
              render={
                <Button type="button" variant="outline" size="icon-sm">
                  <MenuIcon className="size-4" />
                </Button>
              }
            />
            <SheetContent side="right" className="w-[min(20rem,calc(100vw-2rem))] p-0">
              <SheetHeader className="border-b border-border">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-2 p-4">
                <nav aria-label="Marketing" className="flex flex-col gap-1">
                  <Link href="/pricing" className="px-3 py-2 text-sm font-medium text-foreground">
                    {tNav("pricing")}
                  </Link>
                  <Link href="/portfolio-maker" className="px-3 py-2 text-sm font-medium text-foreground">
                    {tNav("portfolioMaker")}
                  </Link>
                  <Link href="/book-demo" className="px-3 py-2 text-sm font-medium text-foreground">
                    {tNav("bookDemo")}
                  </Link>
                  <Link href="/contact" className="px-3 py-2 text-sm font-medium text-foreground">
                    {tNav("contact")}
                  </Link>
                  <Link href="/sign-in" className="px-3 py-2 text-sm font-medium text-foreground">
                    {tNav("signIn")}
                  </Link>
                </nav>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <ThemeToggle variant="standalone" />
                  <Suspense fallback={<div className="size-9" />}>
                    <LocaleSwitcher variant="standalone" />
                  </Suspense>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
