import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComingSoonFallback } from "./ComingSoonFallback";
import type { WorkspaceDoc } from "@/lib/db/models/Workspace";
import { Types } from "mongoose";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkspace(overrides: Partial<WorkspaceDoc> = {}): WorkspaceDoc {
  return {
    _id: new Types.ObjectId(),
    slug: "test-studio",
    name: "Test Studio",
    ownerUserId: "user_001",
    clerkOrgId: "org_001",
    businessType: "photographer",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    branding: {
      logoUrl: null,
      logoCloudinaryPublicId: null,
      primaryColor: "#1a1a2e",
      secondaryColor: "#e9e9e9",
      tagline: "Capturing memories for life",
      description: "",
    },
    publicPage: {
      templateId: "minimal",
      data: { home: null, gallery: null },
      brandKit: {
        themePreset: "minimal",
        fontPair: "merriweather-only",
        primaryColor: "#1a1a2e",
        secondaryColor: "#e9e9e9",
        accentColor: "#2f5d56",
        backgroundColor: "#ffffff",
        foregroundColor: "#111111",
        radius: "sharp",
        buttonStyle: "solid",
      },
      publishedAt: new Date("2025-01-01T00:00:00Z"),
      lastPublishedAt: null,
      latestVersion: 0,
      seoTitle: "",
      seoDescription: "",
      inquiryRecipientEmail: "",
    },
    customDomain: null,
    plan: "free",
    hitpayRecurringBillingId: null,
    hitpayRecurringReference: null,
    hitpayRecurringStatus: null,
    hitpayCurrentPeriodEnd: null,
    trialEndsAt: null,
    onboardingCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as WorkspaceDoc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ComingSoonFallback", () => {
  it("renders without crashing", () => {
    const workspace = makeWorkspace();
    const { container } = render(<ComingSoonFallback workspace={workspace} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("displays the workspace name", () => {
    const workspace = makeWorkspace({ name: "Luna Photography" });
    render(<ComingSoonFallback workspace={workspace} />);
    expect(screen.getByText("Luna Photography")).toBeInTheDocument();
  });

  it("displays the tagline when present", () => {
    const workspace = makeWorkspace();
    render(<ComingSoonFallback workspace={workspace} />);
    expect(screen.getByText("Capturing memories for life")).toBeInTheDocument();
  });

  it("does not render a tagline paragraph when tagline is empty", () => {
    const workspace = makeWorkspace({
      branding: {
        logoUrl: null,
        logoCloudinaryPublicId: null,
        primaryColor: "#111111",
        secondaryColor: "#f5f5f5",
        tagline: "",
        description: "",
      },
    });
    render(<ComingSoonFallback workspace={workspace} />);
    // "Coming soon" is always present
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    // An empty tagline should not produce an empty paragraph
    const paragraphs = screen.queryAllByRole("paragraph");
    const emptyParagraphs = paragraphs.filter((p) => p.textContent?.trim() === "");
    expect(emptyParagraphs).toHaveLength(0);
  });

  it("renders the 'Coming soon' message", () => {
    const workspace = makeWorkspace();
    render(<ComingSoonFallback workspace={workspace} />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("shows the logo image when logoUrl is provided", () => {
    const workspace = makeWorkspace({
      branding: {
        logoUrl: "https://res.cloudinary.com/example/image/upload/v1/logo.png",
        logoCloudinaryPublicId: "example/logo",
        primaryColor: "#111111",
        secondaryColor: "#f5f5f5",
        tagline: "",
        description: "",
      },
    });
    render(<ComingSoonFallback workspace={workspace} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      "https://res.cloudinary.com/example/image/upload/v1/logo.png"
    );
    expect(img).toHaveAttribute("alt", "Test Studio logo");
  });

  it("does not render a logo image when logoUrl is null", () => {
    const workspace = makeWorkspace({
      branding: {
        logoUrl: null,
        logoCloudinaryPublicId: null,
        primaryColor: "#111111",
        secondaryColor: "#f5f5f5",
        tagline: "",
        description: "",
      },
    });
    render(<ComingSoonFallback workspace={workspace} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("applies brand-kit CSS variables via the main element style", () => {
    const workspace = makeWorkspace();
    const { container } = render(<ComingSoonFallback workspace={workspace} />);
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    // happy-dom serialises font-family var() references; background/color vars
    // may be normalised away. Verify at least the font-family var is applied,
    // which confirms the component uses --pf-* references in its inline style.
    expect(main?.getAttribute("style")).toContain("--pf-font-body");
  });

  it("shows 'Powered by Gallurio' attribution", () => {
    const workspace = makeWorkspace();
    render(<ComingSoonFallback workspace={workspace} />);
    expect(screen.getByText("Powered by Gallurio")).toBeInTheDocument();
  });
});
