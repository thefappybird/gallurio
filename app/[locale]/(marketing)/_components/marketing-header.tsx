"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { MenuIcon } from "lucide-react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isEditorialRoute } from "./editorial-route";

const ENGLISH_NAV = {
  portfolioMaker: "Portfolio Builder",
  about: "About",
  pricing: "Pricing",
  bookDemo: "Book a Demo",
  resources: "Resources",
  signIn: "Sign in",
  getStarted: "Get started",
} as const;

export function MarketingHeader() {
  const tNav = useTranslations("marketing.nav");
  const tAppInfo = useTranslations("marketing.appInfo");
  const pathname = usePathname();
  const englishOnly = isEditorialRoute(pathname);
  const label = (key: keyof typeof ENGLISH_NAV) => {
    if (englishOnly) return ENGLISH_NAV[key];
    if (key === "about") return tAppInfo("navigationLabel");
    return tNav(key);
  };

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
              href="/portfolio-maker-demo"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label("portfolioMaker")}
            </Link>
            <Link
              href="/about"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label("about")}
            </Link>
            <Link
              href="/pricing"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label("pricing")}
            </Link>
            <Link
              href="/book-demo"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label("bookDemo")}
            </Link>
            <Link
              href="/resources"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label("resources")}
            </Link>
          </nav>

          <div className="flex items-center gap-1 gap-x-4">
            <Link href="/sign-in" className="flex items-center gap-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {label("signIn")}
            </Link>
            <Link href="/sign-up" className={buttonVariants({ variant: "brand", size: "sm" })}>
              {label("getStarted")}
            </Link>
            <ThemeToggle variant="standalone" />
            {englishOnly ? null : (
              <Suspense fallback={<div className="size-9" />}>
                <LocaleSwitcher variant="standalone" />
              </Suspense>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:hidden">
          <Link
            href="/sign-up"
            className={buttonVariants({ variant: "brand", size: "sm", className: "whitespace-nowrap" })}
          >
            {label("getStarted")}
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
                  <Link href="/portfolio-maker-demo" className="px-3 py-2 text-sm font-medium text-foreground">
                    {label("portfolioMaker")}
                  </Link>
                  <Link href="/about" className="px-3 py-2 text-sm font-medium text-foreground">
                    {label("about")}
                  </Link>
                  <Link href="/pricing" className="px-3 py-2 text-sm font-medium text-foreground">
                    {label("pricing")}
                  </Link>
                  <Link href="/book-demo" className="px-3 py-2 text-sm font-medium text-foreground">
                    {label("bookDemo")}
                  </Link>
                  <Link href="/resources" className="px-3 py-2 text-sm font-medium text-foreground">
                    {label("resources")}
                  </Link>
                  <Link href="/sign-in" className="px-3 py-2 text-sm font-medium text-foreground">
                    {label("signIn")}
                  </Link>
                </nav>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <ThemeToggle variant="standalone" />
                  {englishOnly ? null : (
                    <Suspense fallback={<div className="size-9" />}>
                      <LocaleSwitcher variant="standalone" />
                    </Suspense>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
