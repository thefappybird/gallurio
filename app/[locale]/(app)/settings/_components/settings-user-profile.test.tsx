import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test-utils/render";
import { SettingsUserProfile } from "./settings-user-profile";
import type { SettingsPage } from "./settings-user-profile";

// Stub next-intl.
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: () => (key: string) => {
      const map: Record<string, string> = {
        navigationLabel: "Settings navigation",
        selectPage: "Select a page from the sidebar.",
      };
      return map[key] ?? key;
    },
    usePathname: () => "/settings",
  };
});

const dummyIcon = <span data-testid="dummy-icon" />;

const allPages: SettingsPage[] = [
  {
    slug: "account",
    label: "Account",
    icon: dummyIcon,
    body: <div data-testid="body-account">account content</div>,
  },
  {
    slug: "customize",
    label: "Customize",
    icon: dummyIcon,
    body: <div data-testid="body-customize">customize content</div>,
  },
  {
    slug: "workspace",
    label: "Workspace",
    icon: dummyIcon,
    ownerOnly: true,
    body: <div data-testid="body-workspace">workspace content</div>,
  },
  {
    slug: "billing",
    label: "Billing",
    icon: dummyIcon,
    ownerOnly: true,
    body: <div data-testid="body-billing">billing content</div>,
  },
];

function renderSettings(
  role: "owner" | "staff",
  activeSlug: string | null = "account",
  workspaceName = "Solo Workspace",
) {
  return renderWithProviders(
    <SettingsUserProfile
      role={role}
      pages={allPages}
      activeSlug={activeSlug}
      workspaceName={workspaceName}
    />,
  );
}

describe("SettingsUserProfile", () => {
  describe("role=owner", () => {
    it("renders nav links for all pages including ownerOnly ones", () => {
      renderSettings("owner");
      expect(screen.getByRole("link", { name: /account/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /customize/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /workspace/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /billing/i })).toBeInTheDocument();
    });

    it("renders the active page body", () => {
      renderSettings("owner", "account");
      expect(screen.getByTestId("body-account")).toBeInTheDocument();
    });

    it("uses the underline active treatment for the current tab", () => {
      renderSettings("owner", "account");
      const accountLink = screen.getByRole("link", { name: /account/i });
      expect(accountLink.className).toContain("border-brand");
      expect(accountLink.className).toContain("text-brand");
    });

    it("renders the workspace name bar", () => {
      renderSettings("owner");
      expect(screen.getByText("Solo Workspace")).toBeInTheDocument();
    });
  });

  describe("role=staff", () => {
    it("renders only non-ownerOnly nav links", () => {
      renderSettings("staff");
      expect(screen.getByRole("link", { name: /account/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /customize/i })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /workspace/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /billing/i })).not.toBeInTheDocument();
    });

    it("renders the active page body for visible page", () => {
      renderSettings("staff", "account");
      expect(screen.getByTestId("body-account")).toBeInTheDocument();
    });
  });

  describe("responsive nav variants", () => {
    it("renders a single nav landmark used at every breakpoint", () => {
      renderSettings("owner");
      const navs = screen.getAllByRole("navigation", { name: "Settings navigation" });
      expect(navs).toHaveLength(1);
    });

    it("scroll-snaps the rail and stacks icon-over-label below sm, icon-beside-label from sm up", () => {
      renderSettings("owner");
      const nav = screen.getByRole("navigation", { name: "Settings navigation" });
      expect(nav.className).toContain("overflow-x-auto");
      expect(nav.className).toContain("snap-x");
      expect(nav.className).toContain("snap-mandatory");

      const accountLink = screen.getByRole("link", { name: /account/i });
      expect(accountLink.className).toContain("flex-col");
      expect(accountLink.className).toContain("snap-start");
      expect(accountLink.className).toContain("sm:flex-row");
    });
  });

  describe("tab-nav pending affordance", () => {
    it("marks the clicked (non-active) tab as busy until activeSlug catches up", () => {
      const { rerender } = renderSettings("owner", "account");
      for (const link of screen.getAllByRole("link", { name: /customize/i })) {
        fireEvent.click(link);
      }
      for (const link of screen.getAllByRole("link", { name: /customize/i })) {
        expect(link).toHaveAttribute("aria-busy", "true");
      }
      // The currently-active tab never gets the busy treatment.
      for (const link of screen.getAllByRole("link", { name: /account/i })) {
        expect(link).not.toHaveAttribute("aria-busy");
      }

      rerender(
        <SettingsUserProfile
          role="owner"
          pages={allPages}
          activeSlug="customize"
          workspaceName="Solo Workspace"
        />,
      );
      for (const link of screen.getAllByRole("link", { name: /customize/i })) {
        expect(link).not.toHaveAttribute("aria-busy");
      }
    });
  });
});
