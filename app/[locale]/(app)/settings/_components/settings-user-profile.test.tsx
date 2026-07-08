import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test-utils/render";
import { SettingsUserProfile } from "./settings-user-profile";
import type { SettingsPage } from "./settings-user-profile";

// Stub SettingsOrgSwitcher so it doesn't pull in server actions.
vi.mock("./settings-org-switcher", () => ({
  SettingsOrgSwitcher: () => <div data-testid="org-switcher" />,
}));

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

const mockWorkspaces = [
  { id: "ws_aaa", name: "Workspace A" },
  { id: "ws_bbb", name: "Workspace B" },
];

const singleWorkspace = [{ id: "ws_aaa", name: "Solo Workspace" }];

function renderSettings(
  role: "owner" | "staff",
  activeSlug: string | null = "account",
  workspaces = mockWorkspaces,
  currentWorkspaceId = "ws_aaa",
) {
  return renderWithProviders(
    <SettingsUserProfile
      role={role}
      pages={allPages}
      activeSlug={activeSlug}
      workspaces={workspaces}
      currentWorkspaceId={currentWorkspaceId}
    />,
  );
}

describe("SettingsUserProfile", () => {
  describe("role=owner", () => {
    it("renders nav links for all pages including ownerOnly ones", () => {
      renderSettings("owner");
      expect(screen.getAllByRole("link", { name: /account/i })).toHaveLength(2);
      expect(screen.getAllByRole("link", { name: /customize/i })).toHaveLength(2);
      expect(screen.getAllByRole("link", { name: /workspace/i })).toHaveLength(2);
      expect(screen.getAllByRole("link", { name: /billing/i })).toHaveLength(2);
    });

    it("renders the active page body", () => {
      renderSettings("owner", "account");
      expect(screen.getByTestId("body-account")).toBeInTheDocument();
    });

    it("uses the brand active treatment for the current page in both nav variants", () => {
      renderSettings("owner", "account");
      const accountLinks = screen.getAllByRole("link", { name: /account/i });
      expect(accountLinks).toHaveLength(2);
      for (const link of accountLinks) {
        expect(link.className).toContain("bg-brand/12");
        expect(link.className).toContain("text-brand");
      }
    });

    it("renders org-switcher bar", () => {
      renderSettings("owner");
      expect(screen.getByTestId("org-switcher")).toBeInTheDocument();
    });
  });

  describe("role=staff", () => {
    it("renders only non-ownerOnly nav links", () => {
      renderSettings("staff");
      expect(screen.getAllByRole("link", { name: /account/i })).toHaveLength(2);
      expect(screen.getAllByRole("link", { name: /customize/i })).toHaveLength(2);
      expect(screen.queryByRole("link", { name: /workspace/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /billing/i })).not.toBeInTheDocument();
    });

    it("renders the active page body for visible page", () => {
      renderSettings("staff", "account");
      expect(screen.getByTestId("body-account")).toBeInTheDocument();
    });
  });

  describe("responsive nav variants", () => {
    it("renders both a mobile tab-strip nav and a desktop sidebar nav with the same aria-label", () => {
      renderSettings("owner");
      const navs = screen.getAllByRole("navigation", { name: "Settings navigation" });
      expect(navs).toHaveLength(2);
    });

    it("mobile strip is hidden at lg and desktop sidebar is hidden below lg", () => {
      renderSettings("owner");
      const navs = screen.getAllByRole("navigation", { name: "Settings navigation" });
      const mobileNav = navs.find((n) => n.className.includes("overflow-x-auto"));
      const desktopNav = navs.find((n) => n.className.includes("w-48"));
      expect(mobileNav?.className).toContain("lg:hidden");
      expect(desktopNav?.className).toContain("hidden");
      expect(desktopNav?.className).toContain("lg:flex");
    });
  });

  describe("workspace switcher bar", () => {
    it("renders the org-switcher dropdown when there are 2+ workspaces", () => {
      renderSettings("owner", "account", mockWorkspaces, "ws_aaa");
      expect(screen.getByTestId("org-switcher")).toBeInTheDocument();
    });

    it("does NOT render the org-switcher dropdown when there is only 1 workspace", () => {
      renderSettings("owner", "account", singleWorkspace, "ws_aaa");
      expect(screen.queryByTestId("org-switcher")).not.toBeInTheDocument();
    });

    it("renders the single workspace name as static text when there is only 1 workspace", () => {
      renderSettings("owner", "account", singleWorkspace, "ws_aaa");
      expect(screen.getByText("Solo Workspace")).toBeInTheDocument();
    });

    it("falls back to the first workspace name when currentWorkspaceId has no match", () => {
      renderSettings("owner", "account", singleWorkspace, "ws_unknown");
      expect(screen.getByText("Solo Workspace")).toBeInTheDocument();
    });
  });
});
