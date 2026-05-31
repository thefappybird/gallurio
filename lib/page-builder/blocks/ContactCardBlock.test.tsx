import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ContactCardBlock, contactCardDefaultProps } from "./ContactCardBlock";
import { runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import type { ContactCardProps } from "./ContactCardBlock";
import type { RenderWorkspace } from "@/lib/page-builder/serverContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fullWorkspace: RenderWorkspace = {
  _id: "ws_test_001",
  name: "Test Studio",
  branding: {
    logoUrl: null,
    tagline: "Fine art photography",
    description: "Beautiful moments captured.",
  },
  contact: {
    email: "hello@studio.com",
    phone: "+63 917 000 0000",
    address: "Makati City, Metro Manila",
    socials: {
      instagram: "studioig",
      facebook: "studiofb",
      tiktok: null,
      website: "https://studio.com",
    },
  },
};

function renderContact(
  overrides: Partial<ContactCardProps> = {},
  workspace: RenderWorkspace | null = fullWorkspace
) {
  if (workspace) {
    return runWithRenderWorkspace(workspace, () =>
      render(<ContactCardBlock {...contactCardDefaultProps} {...overrides} />)
    );
  }
  // No workspace context — getRenderWorkspace() returns null
  return render(<ContactCardBlock {...contactCardDefaultProps} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe("ContactCardBlock — renders with default props", () => {
  it("renders without crashing", () => {
    const { container } = renderContact();
    expect(container.firstChild).not.toBeNull();
  });

  it("renders data-block=contact-card marker", () => {
    const { container } = renderContact();
    expect(container.querySelector("[data-block='contact-card']")).toBeInTheDocument();
  });

  it("renders the heading", () => {
    renderContact({ heading: "Say Hello" });
    expect(screen.getByText("Say Hello")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Brand-kit CSS variables
// ---------------------------------------------------------------------------

describe("ContactCardBlock — brand-kit CSS variables", () => {
  it("section uses var(--pf-color-bg)", () => {
    const { container } = renderContact();
    const section = container.querySelector("[data-block='contact-card']") as HTMLElement;
    expect(section.style.backgroundColor).toBe("var(--pf-color-bg)");
  });

  it("section uses var(--pf-color-fg)", () => {
    const { container } = renderContact();
    const section = container.querySelector("[data-block='contact-card']") as HTMLElement;
    expect(section.style.color).toBe("var(--pf-color-fg)");
  });

  it("heading uses var(--pf-font-heading)", () => {
    const { container } = renderContact({ heading: "Contact" });
    const h2 = container.querySelector("h2") as HTMLElement;
    expect(h2.style.fontFamily).toBe("var(--pf-font-heading)");
  });

  it("CTA button uses var(--pf-color-accent)", () => {
    const { container } = renderContact({ inlineCtaLabel: "Send Message" });
    const cta = container.querySelector("[data-cta='contact']") as HTMLElement;
    expect(cta.style.backgroundColor).toBe("var(--pf-color-accent)");
  });

  it("CTA button uses var(--pf-radius)", () => {
    const { container } = renderContact({ inlineCtaLabel: "Send Message" });
    const cta = container.querySelector("[data-cta='contact']") as HTMLElement;
    expect(cta.style.borderRadius).toBe("var(--pf-radius)");
  });

  it("email link uses var(--pf-color-accent)", () => {
    const { container } = renderContact({ showEmail: true });
    const emailLink = container.querySelector("a[href^='mailto:']") as HTMLElement;
    expect(emailLink.style.color).toBe("var(--pf-color-accent)");
  });
});

// ---------------------------------------------------------------------------
// Workspace contact values (from server context, not props)
// ---------------------------------------------------------------------------

describe("ContactCardBlock — contact values from workspace context", () => {
  it("displays email from workspace context", () => {
    renderContact({ showEmail: true });
    expect(screen.getByText("hello@studio.com")).toBeInTheDocument();
  });

  it("displays phone from workspace context", () => {
    renderContact({ showPhone: true });
    expect(screen.getByText("+63 917 000 0000")).toBeInTheDocument();
  });

  it("displays address from workspace context", () => {
    renderContact({ showAddress: true });
    expect(screen.getByText("Makati City, Metro Manila")).toBeInTheDocument();
  });

  it("displays social links from workspace context", () => {
    renderContact({ showSocials: true });
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("Facebook")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
  });

  it("displays tagline from branding context", () => {
    renderContact();
    expect(screen.getByTestId("contact-tagline")).toHaveTextContent(
      "Fine art photography"
    );
  });
});

// ---------------------------------------------------------------------------
// Show/hide flags
// ---------------------------------------------------------------------------

describe("ContactCardBlock — show/hide flags", () => {
  it("hides email when showEmail=false", () => {
    renderContact({ showEmail: false });
    expect(screen.queryByText("hello@studio.com")).toBeNull();
  });

  it("hides phone when showPhone=false", () => {
    renderContact({ showPhone: false });
    expect(screen.queryByText("+63 917 000 0000")).toBeNull();
  });

  it("hides address when showAddress=false", () => {
    renderContact({ showAddress: false });
    expect(screen.queryByText("Makati City, Metro Manila")).toBeNull();
  });

  it("hides socials when showSocials=false", () => {
    renderContact({ showSocials: false });
    expect(screen.queryByTestId("socials-row")).toBeNull();
  });

  it("hides inline CTA when inlineCtaLabel is empty", () => {
    const { container } = renderContact({ inlineCtaLabel: "" });
    expect(container.querySelector("[data-cta='contact']")).toBeNull();
  });

  it("hides inline CTA when inlineCtaLabel is undefined", () => {
    const { container } = renderContact({ inlineCtaLabel: undefined });
    expect(container.querySelector("[data-cta='contact']")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// No workspace context — graceful degradation
// ---------------------------------------------------------------------------

describe("ContactCardBlock — no workspace context", () => {
  it("renders without crashing when no workspace context set", () => {
    expect(() => renderContact({}, null)).not.toThrow();
  });

  it("does not render any contact fields when workspace has no contact info", () => {
    renderContact(
      { showEmail: true, showPhone: true, showAddress: true, showSocials: true },
      { _id: "empty_ws", name: "Empty Studio" }
    );
    // Contact details section should be empty (no rows)
    const details = screen.getByTestId("contact-details");
    // Should have no children with content
    expect(details.querySelectorAll("div").length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Socials URL building
// ---------------------------------------------------------------------------

describe("ContactCardBlock — socials URL building", () => {
  it("builds Instagram URL from handle", () => {
    const { container } = renderContact({ showSocials: true });
    const igLink = container.querySelector("a[href*='instagram.com']") as HTMLAnchorElement;
    expect(igLink).not.toBeNull();
    expect(igLink.href).toContain("instagram.com/studioig");
  });

  it("uses website URL as-is when it starts with http", () => {
    const { container } = renderContact({ showSocials: true });
    const websiteLink = container.querySelector("a[href='https://studio.com']") as HTMLAnchorElement;
    expect(websiteLink).not.toBeNull();
    expect(websiteLink.textContent).toBe("Website");
  });

  it("does not render TikTok link when tiktok is null", () => {
    renderContact({ showSocials: true });
    expect(screen.queryByText("TikTok")).toBeNull();
  });

  it("rejects a javascript: website URL (no XSS href)", () => {
    const ws: RenderWorkspace = {
      _id: "ws",
      name: "S",
      contact: { socials: { website: "javascript:alert(document.cookie)" } },
    };
    const { container } = renderContact({ showSocials: true }, ws);
    // No anchor carries the javascript: scheme, and the Website link is dropped.
    expect(container.querySelector("a[href^='javascript:']")).toBeNull();
    expect(screen.queryByText("Website")).toBeNull();
  });

  it("prefixes https:// for a bare-domain website", () => {
    const ws: RenderWorkspace = {
      _id: "ws",
      name: "S",
      contact: { socials: { website: "studio.example" } },
    };
    const { container } = renderContact({ showSocials: true }, ws);
    const link = container.querySelector(
      "a[href='https://studio.example']"
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
  });

  it("links open in new tab with noopener", () => {
    const { container } = renderContact({ showSocials: true });
    const socialLinks = container.querySelectorAll("[data-testid='socials-row'] a");
    for (const link of socialLinks) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});

// ---------------------------------------------------------------------------
// Email href
// ---------------------------------------------------------------------------

describe("ContactCardBlock — email href", () => {
  it("email link has correct mailto href", () => {
    const { container } = renderContact({ showEmail: true });
    const emailLink = container.querySelector("a[href^='mailto:']") as HTMLAnchorElement;
    expect(emailLink.href).toBe("mailto:hello@studio.com");
  });
});

// ---------------------------------------------------------------------------
// Missing optional props
// ---------------------------------------------------------------------------

describe("ContactCardBlock — missing optional props", () => {
  it("renders without description (no crash)", () => {
    expect(() => renderContact({ description: undefined })).not.toThrow();
  });

  it("renders without inlineCtaLabel (no crash)", () => {
    expect(() => renderContact({ inlineCtaLabel: undefined })).not.toThrow();
  });
});
