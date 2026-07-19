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
  routing: { defaultLocale: "en", locales: ["en", "fil", "id", "th"] },
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

vi.mock("../_actions", () => ({
  updatePublicPageSettingsAction: vi.fn(),
  togglePublicPagePublishedAction: vi.fn(),
}));

import { uploadImage } from "@/lib/storage/uploadImage.client";
import { uploadAsset } from "@/lib/storage/uploadAsset.client";
import { publishDraftAction } from "../../portfolio/_draftActions";
import {
  togglePublicPagePublishedAction,
  updatePublicPageSettingsAction,
} from "../_actions";

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
  logoUrl: "",
  logoAssetId: "",
  siteIconUrl: "",
  siteIconAssetId: "",
  seo: {
    keywords: [],
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

  it("renders SEO keywords field beside the SEO inputs", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );
    expect(screen.getByLabelText("seoKeywords")).toBeInTheDocument();
    expect(screen.getByText("seoKeywordsHint")).toBeInTheDocument();
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

describe("PublicPageSettingsForm — header logo section", () => {
  it("renders the logo upload area when logoUrl is empty", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );
    expect(screen.getByText("logoLabel")).toBeInTheDocument();
  });

  it("shows logo preview when logoUrl is set in defaults", () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={{ ...baseDefaults, logoUrl: "https://cdn.example.com/logo.png" }}
        locale="en"
      />
    );
    const img = screen.getByRole("img", { name: "logoLabel" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("https://cdn.example.com/logo.png"),
    );
  });

  it("sets the hidden logo inputs after a successful upload", async () => {
    vi.mocked(uploadAsset).mockResolvedValueOnce({
      asset: { assetId: "logo-asset-1", url: "https://cdn.cf.net/logo-new.png" },
    } as Awaited<ReturnType<typeof uploadAsset>>);

    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );

    const fileInput = document.querySelector("#logoFile") as HTMLInputElement;
    const file = new File(["data"], "logo.png", { type: "image/png" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(document.querySelector('input[name="logoUrl"]')).toHaveValue(
      "https://cdn.cf.net/logo-new.png",
    );
    expect(document.querySelector('input[name="logoAssetId"]')).toHaveValue(
      "logo-asset-1",
    );
  });

  it("clears the hidden logo inputs when Remove is clicked", async () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={{
          ...baseDefaults,
          logoUrl: "https://cdn.example.com/logo.png",
          logoAssetId: "asset-x",
        }}
        locale="en"
      />
    );

    const removeBtn = screen.getByRole("button", { name: "logoRemove" });
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    expect(document.querySelector('input[name="logoUrl"]')).toHaveValue("");
    expect(document.querySelector('input[name="logoAssetId"]')).toHaveValue("");
    expect(screen.getByText("logoLabel")).toBeInTheDocument();
  });

  it("clicking Replace opens the file dialog for the hidden logo input", async () => {
    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={{ ...baseDefaults, logoUrl: "https://cdn.example.com/logo.png" }}
        locale="en"
      />
    );

    const fileInput = document.querySelector("#logoFile") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    const replaceBtn = screen.getByRole("button", { name: "logoReplace" });
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("shows an error alert when the logo upload fails", async () => {
    vi.mocked(uploadAsset).mockResolvedValueOnce({
      error: "file_too_large",
    } as Awaited<ReturnType<typeof uploadAsset>>);

    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );

    const fileInput = document.querySelector("#logoFile") as HTMLInputElement;
    const file = new File(["data"], "logo.png", { type: "image/png" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows the uploading state while a logo upload is in flight", async () => {
    let resolveUpload!: (v: Awaited<ReturnType<typeof uploadAsset>>) => void;
    vi.mocked(uploadAsset).mockReturnValueOnce(
      new Promise((res) => {
        resolveUpload = res;
      }),
    );

    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );

    const fileInput = document.querySelector("#logoFile") as HTMLInputElement;
    const file = new File(["data"], "logo.png", { type: "image/png" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(screen.getByText("logoUploading")).toBeInTheDocument();

    await act(async () => {
      resolveUpload({
        asset: { assetId: "a", url: "https://cdn.cf.net/x.png" },
      } as Awaited<ReturnType<typeof uploadAsset>>);
    });
  });

  it("shows an error alert when the logo upload throws", async () => {
    vi.mocked(uploadAsset).mockRejectedValueOnce(new Error("upload_failed"));

    render(
      <PublicPageSettingsForm
        slug="luna-studio"
        publishedAt={null}
        defaults={baseDefaults}
        locale="en"
      />
    );

    const fileInput = document.querySelector("#logoFile") as HTMLInputElement;
    const file = new File(["data"], "logo.png", { type: "image/png" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("flags pending changes after saving a newly uploaded logo", async () => {
    vi.mocked(uploadAsset).mockResolvedValueOnce({
      asset: { assetId: "logo-a", url: "https://cdn.cf.net/logo.png" },
    } as Awaited<ReturnType<typeof uploadAsset>>);
    vi.mocked(updatePublicPageSettingsAction).mockResolvedValueOnce({
      ok: true,
    } as Awaited<ReturnType<typeof updatePublicPageSettingsAction>>);

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

    const fileInput = document.querySelector("#logoFile") as HTMLInputElement;
    const file = new File(["data"], "logo.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const saveBtn = screen.getByText("save").closest("button")!;
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(screen.getByText("pendingChangesBannerTitle")).toBeInTheDocument();

    // These mocks have no shared reset; clear our call so the later
    // absolute-call-count assertion in the keywords suite stays accurate.
    vi.mocked(updatePublicPageSettingsAction).mockClear();
  });
});

describe("PublicPageSettingsForm — publish + pending-changes banner", () => {
  it("hides the banner and shows Unpublish when there are no pending changes", () => {
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
    expect(screen.getByRole("button", { name: "unpublish" })).toBeEnabled();
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
    expect(screen.getByRole("button", { name: "publish" })).toBeEnabled();
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

    const publishBtn = screen.getByRole("button", { name: "publish" });
    await act(async () => {
      fireEvent.click(publishBtn);
    });

    expect(publishDraftAction).toHaveBeenCalledWith("draft-1");
    expect(screen.queryByText("pendingChangesBannerTitle")).not.toBeInTheDocument();
  });

  it("unpublishes from the top action row when the live page has no pending changes", async () => {
    vi.mocked(togglePublicPagePublishedAction).mockResolvedValueOnce({ ok: true });

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

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "unpublish" }));
    });

    expect(togglePublicPagePublishedAction).toHaveBeenCalledWith(false);
  });
});

describe("PublicPageSettingsForm — SEO keywords pending recompute after Save", () => {
  it("keeps the banner visible and Publish enabled after a Save whose keywords still differ from published", async () => {
    vi.mocked(updatePublicPageSettingsAction).mockResolvedValueOnce({
      ok: true,
    } as Awaited<ReturnType<typeof updatePublicPageSettingsAction>>);

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

    const keywordsInput = screen.getByLabelText("seoKeywords");
    fireEvent.change(keywordsInput, {
      target: { value: "wedding photographer, editorial" },
    });

    const saveBtn = screen.getByText("save").closest("button")!;
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(updatePublicPageSettingsAction).toHaveBeenCalledTimes(1);
    expect(updatePublicPageSettingsAction).toHaveBeenCalledWith(
      expect.objectContaining({
        seo: expect.objectContaining({
          keywords: ["wedding", "photographer", "editorial"],
        }),
      })
    );
    expect(screen.getByText("pendingChangesBannerTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "publish" })).toBeEnabled();
  });
});
