/**
 * Tests for the PublicPageSettingsForm site icon section.
 *
 * Strategy: render the form with controlled defaults and assert the presence
 * of the upload area (idle state) or preview image (populated state).
 * Upload network behavior is tested in uploadAsset.client.test.ts.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ── External mocks required by the transitive import tree ───────────────────

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn() }),
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/lib/auth/activeWorkspace", () => ({
  getActiveWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/workos", () => ({
  workos: { userManagement: {}, multiFactorAuth: {} },
}));

vi.mock("@/lib/server/authRateLimit", () => ({
  checkAuthRateLimit: vi.fn(),
}));

vi.mock("@/lib/email/sendPasswordResetEmail", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/storage/cloudflareImages", () => ({
  deleteImage: vi.fn(),
}));

vi.mock("@/lib/i18n/routing", () => ({
  routing: { defaultLocale: "en", locales: ["en", "fil", "ms", "id"] },
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  setRequestLocale: vi.fn(),
}));

// ── Component-level mocks ───────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock("@/lib/storage/uploadAsset.client", () => ({
  uploadAsset: vi.fn(),
}));

vi.mock("@/lib/utils/handleActionResult", () => ({
  toastActionResult: vi.fn(() => true),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ── Component import (after mocks) ──────────────────────────────────────────

import { PublicPageSettingsForm } from "./_form";
import type { PublicPageSettingsInput } from "@/lib/validators/workspace";

const baseDefaults: PublicPageSettingsInput = {
  seoTitle: "",
  seoDescription: "",
  inquiryRecipientEmail: "",
  siteIconUrl: "",
  siteIconAssetId: "",
};

describe("PublicPageSettingsForm — site icon section", () => {
  it("renders the upload area when siteIconUrl is empty", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );
    // The upload label text (translated as the key in tests) should be present
    expect(screen.getByText("siteIconLabel")).toBeInTheDocument();
  });

  it("shows preview image when siteIconUrl is set in defaults", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={{ ...baseDefaults, siteIconUrl: "https://cdn.example.com/icon.png" }}
        locale="en"
      />
    );
    const img = screen.getByRole("img", { name: "siteIconLabel" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", expect.stringContaining("https://cdn.example.com/icon.png"));
  });

  it("shows Remove button text when icon is set", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={{ ...baseDefaults, siteIconUrl: "https://cdn.example.com/icon.png" }}
        locale="en"
      />
    );
    expect(screen.getByText("siteIconRemove")).toBeInTheDocument();
  });
});
