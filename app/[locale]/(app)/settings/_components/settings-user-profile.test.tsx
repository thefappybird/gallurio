import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test-utils/render";
import { SettingsUserProfile, CustomPage } from "./settings-user-profile";

// Stub Clerk's UserProfile so the test doesn't try to boot the full component.
vi.mock("@clerk/nextjs", () => {
  function UserProfile({ children }: { children: React.ReactNode }) {
    return <div data-testid="user-profile">{children}</div>;
  }
  function UserProfilePage({
    url,
    label,
    children,
  }: {
    url: string;
    label: string;
    children?: React.ReactNode;
  }) {
    return (
      <div data-testid="up-page" data-url={url} data-label={label}>
        {children}
      </div>
    );
  }
  UserProfile.Page = UserProfilePage;
  return { UserProfile };
});

// Stub next-themes — we don't need a real theme provider here.
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

// Stub @clerk/themes — buildUserProfileAppearance only reads it for baseTheme.
vi.mock("@clerk/themes", () => ({
  dark: {},
}));

const dummyIcon = <span data-testid="dummy-icon" />;

function renderSettings(role: "owner" | "staff") {
  return renderWithProviders(
    <SettingsUserProfile path="/settings" role={role}>
      <CustomPage slug="customize" labelKey="customize" labelIcon={dummyIcon}>
        <div>customize content</div>
      </CustomPage>
      <CustomPage slug="workspace" labelKey="workspace" labelIcon={dummyIcon} ownerOnly>
        <div>workspace content</div>
      </CustomPage>
      <CustomPage slug="public-page" labelKey="publicPage" labelIcon={dummyIcon} ownerOnly>
        <div>public page content</div>
      </CustomPage>
      <CustomPage slug="danger" labelKey="danger" labelIcon={dummyIcon} ownerOnly>
        <div>danger content</div>
      </CustomPage>
    </SettingsUserProfile>
  );
}

describe("SettingsUserProfile", () => {
  describe("role=owner", () => {
    it("renders all four custom page slugs", () => {
      renderSettings("owner");
      const pages = screen.getAllByTestId("up-page");
      const urls = pages.map((p) => p.getAttribute("data-url"));
      expect(urls).toContain("customize");
      expect(urls).toContain("workspace");
      expect(urls).toContain("public-page");
      expect(urls).toContain("danger");
    });

    it("renders correct translated labels for each page", () => {
      renderSettings("owner");
      const pages = screen.getAllByTestId("up-page");
      const labels = pages.map((p) => p.getAttribute("data-label"));
      // en.json: app.settings.tabs.*
      expect(labels).toContain("Customize");
      expect(labels).toContain("Workspace");
      expect(labels).toContain("Public page");
      expect(labels).toContain("Danger zone");
    });
  });

  describe("role=staff", () => {
    it("renders only the customize page (non-ownerOnly)", () => {
      renderSettings("staff");
      const pages = screen.getAllByTestId("up-page");
      expect(pages).toHaveLength(1);
      expect(pages[0].getAttribute("data-url")).toBe("customize");
    });

    it("does not render ownerOnly pages", () => {
      renderSettings("staff");
      const pages = screen.getAllByTestId("up-page");
      const urls = pages.map((p) => p.getAttribute("data-url"));
      expect(urls).not.toContain("workspace");
      expect(urls).not.toContain("public-page");
      expect(urls).not.toContain("danger");
    });

    it("renders the Customize label", () => {
      renderSettings("staff");
      const page = screen.getByTestId("up-page");
      expect(page.getAttribute("data-label")).toBe("Customize");
    });
  });
});
