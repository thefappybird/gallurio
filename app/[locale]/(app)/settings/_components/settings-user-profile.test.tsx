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
    slug: "danger",
    label: "Danger zone",
    icon: dummyIcon,
    ownerOnly: true,
    body: <div data-testid="body-danger">danger content</div>,
  },
];

const mockWorkspaces = [
  { id: "ws_aaa", name: "Workspace A" },
  { id: "ws_bbb", name: "Workspace B" },
];

function renderSettings(
  role: "owner" | "staff",
  activeSlug: string | null = "account",
) {
  return renderWithProviders(
    <SettingsUserProfile
      role={role}
      pages={allPages}
      activeSlug={activeSlug}
      workspaces={mockWorkspaces}
      currentWorkspaceId="ws_aaa"
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
      expect(screen.getByRole("link", { name: /danger/i })).toBeInTheDocument();
    });

    it("renders the active page body", () => {
      renderSettings("owner", "account");
      expect(screen.getByTestId("body-account")).toBeInTheDocument();
    });

    it("renders org-switcher bar", () => {
      renderSettings("owner");
      expect(screen.getByTestId("org-switcher")).toBeInTheDocument();
    });
  });

  describe("role=staff", () => {
    it("renders only non-ownerOnly nav links", () => {
      renderSettings("staff");
      expect(screen.getByRole("link", { name: /account/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /customize/i })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /workspace/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /danger/i })).not.toBeInTheDocument();
    });

    it("renders the active page body for visible page", () => {
      renderSettings("staff", "account");
      expect(screen.getByTestId("body-account")).toBeInTheDocument();
    });
  });
});
