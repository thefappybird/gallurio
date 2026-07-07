/**
 * Tests for the PublicPageSettingsForm site icon section.
 *
 * Strategy: render the form with controlled defaults and assert the presence
 * of the upload area (idle state) or preview image (populated state).
 * Upload network behavior is tested in uploadAsset.client.test.ts.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

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
  verifyImageOwnership: vi.fn().mockResolvedValue(true),
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

vi.mock("@/lib/storage/uploadImage.client", () => ({
  uploadImage: vi.fn(),
}));

vi.mock("../../portfolio/_draftActions", () => ({
  publishDraftAction: vi.fn(),
}));

import { uploadImage } from "@/lib/storage/uploadImage.client";
import { publishDraftAction } from "../../portfolio/_draftActions";

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
  seo: {
    ogImageUrl: "",
    ogImageAssetId: "",
    galleryDescription: "",
    noindex: false,
  },
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

  it("shows replace control and requirements when icon is set", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={{ ...baseDefaults, siteIconUrl: "https://cdn.example.com/icon.png" }}
        locale="en"
      />
    );
    expect(screen.getByText("siteIconUpload")).toBeInTheDocument();
    expect(screen.getByText("siteIconRequirements")).toBeInTheDocument();
  });

  it("renders galleryDescription field", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );
    expect(screen.getByText("galleryDescriptionLabel")).toBeInTheDocument();
  });

  it("uses responsive grid layouts for visibility, SEO, and media sections", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );

    expect(screen.getByTestId("public-page-visibility-layout")).toHaveClass(
      "grid",
      "lg:grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(screen.getByTestId("public-page-seo-layout")).toHaveClass(
      "grid",
      "xl:grid-cols-2",
    );
    expect(screen.getByTestId("public-page-media-layout")).toHaveClass(
      "grid",
      "xl:grid-cols-2",
    );
  });

  it("renders noindex checkbox", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );
    expect(screen.getByRole("checkbox", { name: /noindex/i })).toBeInTheDocument();
  });

  it("renders OG image upload area when ogImageUrl is empty", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );
    expect(screen.getByText("ogImageLabel")).toBeInTheDocument();
  });

  it("renders OG image preview when ogImageUrl is set", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={{
          ...baseDefaults,
          seo: { ...baseDefaults.seo!, ogImageUrl: "https://cdn.example.com/og.jpg" },
        }}
        locale="en"
      />
    );
    const img = screen.getByRole("img", { name: "ogImageLabel" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", expect.stringContaining("https://cdn.example.com/og.jpg"));
  });

  it("shows OG image preview after successful file upload", async () => {
    vi.mocked(uploadImage).mockResolvedValueOnce({
      url: "https://cdn.cf.net/og-new.jpg",
      assetId: "asset-new-123",
    } as Awaited<ReturnType<typeof uploadImage>>);

    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );

    const fileInput = document.querySelector("#ogImageFile") as HTMLInputElement;
    const file = new File(["data"], "og.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(screen.getByRole("img", { name: "ogImageLabel" })).toHaveAttribute(
      "src",
      "https://cdn.cf.net/og-new.jpg",
    );
  });

  it("clicking OG Remove button returns to upload area", async () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={{
          ...baseDefaults,
          seo: { ...baseDefaults.seo!, ogImageUrl: "https://cdn.example.com/og.jpg" },
        }}
        locale="en"
      />
    );
    // Preview is shown; Remove button should be present
    const removeBtn = screen.getByText("ogImageRemove");
    await act(async () => { fireEvent.click(removeBtn); });
    // After remove, upload area should appear
    expect(screen.getByText("ogImageLabel")).toBeInTheDocument();
  });
});

describe("PublicPageSettingsForm — publish + pending-changes banner", () => {
  it("hides the banner and disables Publish when there are no pending changes", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={new Date("2026-01-01")}
        defaults={baseDefaults}
        locale="en"
        targetDraftId="draft-1"
        initialHasPendingChanges={false}
        publishedDefaults={baseDefaults}
      />
    );
    expect(screen.queryByText("pendingChangesBannerTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("unpublishedBannerTitle")).not.toBeInTheDocument();
    expect(screen.getByText("publishChanges").closest("button")).toBeDisabled();
  });

  it("shows the never-published banner variant when publishedAt is null", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
        targetDraftId="draft-1"
        initialHasPendingChanges={true}
        publishedDefaults={baseDefaults}
      />
    );
    expect(screen.getByText("unpublishedBannerTitle")).toBeInTheDocument();
    expect(screen.getByText("unpublishedBannerBody")).toBeInTheDocument();
    expect(screen.getByText("publishChanges").closest("button")).toBeEnabled();
  });

  it("shows the pending-changes banner variant when publishedAt is set", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={new Date("2026-01-01")}
        defaults={baseDefaults}
        locale="en"
        targetDraftId="draft-1"
        initialHasPendingChanges={true}
        publishedDefaults={baseDefaults}
      />
    );
    expect(screen.getByText("pendingChangesBannerTitle")).toBeInTheDocument();
    expect(screen.getByText("pendingChangesBannerBody")).toBeInTheDocument();
  });

  it("calls publishDraftAction with targetDraftId and clears the banner on success", async () => {
    vi.mocked(publishDraftAction).mockResolvedValueOnce({ ok: true });

    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={new Date("2026-01-01")}
        defaults={baseDefaults}
        locale="en"
        targetDraftId="draft-1"
        initialHasPendingChanges={true}
        publishedDefaults={baseDefaults}
      />
    );

    const publishBtn = screen.getByText("publishChanges").closest("button")!;
    await act(async () => {
      fireEvent.click(publishBtn);
    });

    expect(publishDraftAction).toHaveBeenCalledWith("draft-1");
    expect(screen.queryByText("pendingChangesBannerTitle")).not.toBeInTheDocument();
  });
});
