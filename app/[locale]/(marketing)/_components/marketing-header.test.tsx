import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: (namespace: string) => (key: string) => `${namespace}:${key}`,
  };
});

vi.mock("next/image", () => ({
  default: () => <span data-testid="brand-image" />,
}));

vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => <div data-testid="theme-toggle" /> }));
vi.mock("@/components/app/locale-switcher", () => ({ LocaleSwitcher: () => <div data-testid="locale-switcher" /> }));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n/navigation")>();
  return { ...actual, usePathname: () => route.pathname };
});
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ render: trigger }: { render: React.ReactNode }) => <>{trigger}</>,
}));

import { MarketingHeader } from "./marketing-header";

describe("MarketingHeader", () => {
  it("uses the requested public navigation and includes About", () => {
    route.pathname = "/";
    render(<MarketingHeader />);

    const expectedLinks = [
      ["marketing.nav:discover", "/discover"],
      ["marketing.nav:portfolioMaker", "/portfolio-maker-demo"],
      ["marketing.appInfo:navigationLabel", "/about"],
      ["marketing.nav:pricing", "/pricing"],
      ["marketing.nav:bookDemo", "/book-demo"],
      ["marketing.nav:signIn", "/sign-in"],
      ["marketing.nav:getStarted", "/sign-up"],
    ] as const;

    for (const [label, href] of expectedLinks) {
      expect(screen.getAllByRole("link", { name: label }).some((link) => link.getAttribute("href") === href)).toBe(true);
    }

    expect(screen.queryByRole("link", { name: "marketing.nav:resources" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "marketing.nav:compare" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "marketing.nav:contact" })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "marketing.nav:bookDemo" })) {
      expect(link.className).toContain("border-border");
      expect(link.className).toContain("bg-background");
    }
  });

  it("orders the desktop nav Discover, About, Pricing, Portfolio Builder", () => {
    route.pathname = "/";
    render(<MarketingHeader />);

    const desktopLinks = within(screen.getAllByRole("navigation", { name: "Marketing" })[0]).getAllByRole("link");
    expect(desktopLinks.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["marketing.nav:discover", "/discover"],
      ["marketing.appInfo:navigationLabel", "/about"],
      ["marketing.nav:pricing", "/pricing"],
      ["marketing.nav:portfolioMaker", "/portfolio-maker-demo"],
    ]);
  });

  it("orders the mobile sheet like the desktop nav, then Sign in and an outline Book a Demo", () => {
    route.pathname = "/";
    render(<MarketingHeader />);

    const sheetNav = screen.getAllByRole("navigation", { name: "Marketing" })[1];
    const sheetLinks = [...within(sheetNav.parentElement as HTMLElement).getAllByRole("link")];
    expect(sheetLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/discover",
      "/about",
      "/pricing",
      "/portfolio-maker-demo",
      "/sign-in",
      "/book-demo",
    ]);
    expect(sheetLinks[5].className).toContain("border-border");
  });

  it("uses an English-only shell and hides the locale switcher on editorial routes", () => {
    route.pathname = "/blog/example";
    render(<MarketingHeader />);

    expect(screen.getAllByRole("link", { name: "Discover" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Portfolio Builder" }).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("locale-switcher")).not.toBeInTheDocument();
  });

  it("collapses the desktop nav into the hamburger below xl (1280px)", () => {
    route.pathname = "/";
    const { container } = render(<MarketingHeader />);

    const row = container.querySelector("header > div");
    const desktopNav = row?.children[1];
    const mobileNav = row?.children[2];

    expect(desktopNav?.className).toContain("xl:flex");
    expect(desktopNav?.className).not.toContain("sm:flex");
    expect(mobileNav?.className).toContain("xl:hidden");
    expect(mobileNav?.className).not.toContain("sm:hidden");
  });
});
