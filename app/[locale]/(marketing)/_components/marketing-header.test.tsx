import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}:${key}`,
}));

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
      ["marketing.nav:portfolioMaker", "/portfolio-maker-demo"],
      ["marketing.appInfo:navigationLabel", "/about"],
      ["marketing.nav:pricing", "/pricing"],
      ["marketing.nav:bookDemo", "/book-demo"],
      ["marketing.nav:resources", "/resources"],
      ["marketing.nav:signIn", "/sign-in"],
      ["marketing.nav:getStarted", "/sign-up"],
    ] as const;

    for (const [label, href] of expectedLinks) {
      expect(screen.getAllByRole("link", { name: label }).some((link) => link.getAttribute("href") === href)).toBe(true);
    }

    expect(within(screen.getAllByRole("navigation", { name: "Marketing" })[0]).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/portfolio-maker-demo",
      "/about",
      "/pricing",
      "/book-demo",
      "/resources",
    ]);

    expect(screen.queryByRole("link", { name: "marketing.nav:contact" })).not.toBeInTheDocument();
  });

  it("uses an English-only shell and hides the locale switcher on editorial routes", () => {
    route.pathname = "/blog/example";
    render(<MarketingHeader />);

    expect(screen.getAllByRole("link", { name: "Resources" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Portfolio Builder" }).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("locale-switcher")).not.toBeInTheDocument();
  });
});
