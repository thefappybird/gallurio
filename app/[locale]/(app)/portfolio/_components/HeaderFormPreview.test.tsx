import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { HeaderFormPreview } from "./HeaderFormPreview";
import type { PortfolioBrandKit, PortfolioHeaderConfig } from "@/lib/page-builder/types";

const mockBrandKit: PortfolioBrandKit = {
  themePreset: "minimal",
  fontPair: "merriweather-only",
  headingFont: "merriweather",
  bodyFont: "merriweather",
  primaryColor: "#111111",
  secondaryColor: "#444444",
  accentColor: "#007bff",
  backgroundColor: "#ffffff",
  foregroundColor: "#111111",
  radius: "sharp",
  buttonStyle: "solid",
};

const mockHeader: PortfolioHeaderConfig = {};

describe("HeaderFormPreview", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <HeaderFormPreview header={mockHeader} brandKit={mockBrandKit} workspaceName="My Studio" />,
    );
    expect(container).toBeTruthy();
  });

  it("shows the workspace name as brand text by default", () => {
    render(<HeaderFormPreview header={mockHeader} brandKit={mockBrandKit} workspaceName="My Studio" />);
    expect(screen.getByText("My Studio")).toBeTruthy();
  });

  it("shows brandText override when set", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, brandText: "Custom Brand" }}
        brandKit={mockBrandKit}
        workspaceName="My Studio"
      />,
    );
    expect(screen.getByText("Custom Brand")).toBeTruthy();
    expect(screen.queryByText("My Studio")).toBeNull();
  });

  it("shows nav links: Home, Gallery, Contact", () => {
    render(<HeaderFormPreview header={mockHeader} brandKit={mockBrandKit} workspaceName="Studio" />);
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Gallery")).toBeTruthy();
    expect(screen.getByText("Contact")).toBeTruthy();
  });

  it("applies backgroundColor from token", () => {
    const { container } = render(
      <HeaderFormPreview
        header={{ ...mockHeader, backgroundColor: "primary" }}
        brandKit={{ ...mockBrandKit, primaryColor: "#ff0000" }}
        workspaceName="Studio"
      />,
    );
    const headerEl = container.querySelector("[style*='background-color']") as HTMLElement;
    expect(headerEl).not.toBeNull();
    expect(headerEl.style.backgroundColor).toBe("#ff0000");
  });

  it("applies backgroundOpacity (< 100) as rgba", () => {
    const { container } = render(
      <HeaderFormPreview
        header={{ ...mockHeader, backgroundColor: "background", backgroundOpacity: 50 }}
        brandKit={{ ...mockBrandKit, backgroundColor: "#ffffff" }}
        workspaceName="Studio"
      />,
    );
    const headerEl = container.querySelector("[style*='background-color']") as HTMLElement;
    expect(headerEl).not.toBeNull();
    expect(headerEl.style.backgroundColor).toContain("rgba");
  });

  it("does not apply rgba when backgroundOpacity is 100", () => {
    const { container } = render(
      <HeaderFormPreview
        header={{ ...mockHeader, backgroundColor: "background", backgroundOpacity: 100 }}
        brandKit={{ ...mockBrandKit, backgroundColor: "#ffffff" }}
        workspaceName="Studio"
      />,
    );
    const headerEl = container.querySelector("[style*='background-color']") as HTMLElement;
    expect(headerEl).not.toBeNull();
    expect(headerEl.style.backgroundColor).not.toContain("rgba");
  });

  it("applies drop shadow when shadowSize is set", () => {
    const { container } = render(
      <HeaderFormPreview
        header={{ ...mockHeader, shadowSize: "md" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const headerEl = container.querySelector("[style*='box-shadow']") as HTMLElement;
    expect(headerEl).not.toBeNull();
    expect(headerEl.style.boxShadow).not.toBe("none");
  });

  it("applies no shadow when shadowSize is none", () => {
    const { container } = render(
      <HeaderFormPreview
        header={{ ...mockHeader, shadowSize: "none" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const headerEl = container.querySelector("[style*='box-shadow']") as HTMLElement;
    expect(headerEl).not.toBeNull();
    expect(headerEl.style.boxShadow).toBe("none");
  });

  it("applies linkColor to inactive (Gallery) span — Home is always active", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, linkColor: "accent" }}
        brandKit={{ ...mockBrandKit, accentColor: "#007bff" }}
        workspaceName="Studio"
      />,
    );
    // Home is marked active and inherits activeLinkColor, so check Gallery (inactive).
    const gallerySpan = screen.getByText("Gallery");
    expect(gallerySpan.style.color).toBe("#007bff");
  });

  it("applies linkColor hex directly to inactive links", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, linkColor: "#cc00ff" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const gallerySpan = screen.getByText("Gallery");
    expect(gallerySpan.style.color).toBe("#cc00ff");
  });

  it("applies activeLinkColor to the active (Home) link", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, activeLinkColor: "accent" }}
        brandKit={{ ...mockBrandKit, accentColor: "#007bff" }}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    expect(homeSpan.style.color).toBe("#007bff");
  });

  it("shows logo img when logoUrl is set", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, logoUrl: "https://example.com/logo.png" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain("logo.png");
  });

  it("does not render logo img when logoUrl is not set", () => {
    render(
      <HeaderFormPreview header={mockHeader} brandKit={mockBrandKit} workspaceName="Studio" />,
    );
    const img = document.querySelector("img");
    expect(img).toBeNull();
  });

  it("applies scale transform to active link when activeLinkScale", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, activeLinkScale: true }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    expect(homeSpan.style.transform).toContain("scale");
  });

  it("does not apply scale transform when activeLinkScale is false", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, activeLinkScale: false }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    expect(homeSpan.style.transform).toBeFalsy();
  });

  it("applies background to active link when activeLinkHighlight with custom hex", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, activeLinkHighlight: true, highlightColor: "#ff0000" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    expect(homeSpan.style.backgroundColor).toBe("#ff0000");
  });

  it("applies background from token when activeLinkHighlight with token", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, activeLinkHighlight: true, highlightColor: "accent" }}
        brandKit={{ ...mockBrandKit, accentColor: "#007bff" }}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    expect(homeSpan.style.backgroundColor).toBe("#007bff");
  });

  it("applies highlight opacity and radius to the active link", () => {
    render(
      <HeaderFormPreview
        header={{
          ...mockHeader,
          activeLinkHighlight: true,
          highlightColor: "accent",
          highlightOpacity: 45,
          activeLinkRadius: "rounded",
        }}
        brandKit={{ ...mockBrandKit, accentColor: "#007bff" }}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    expect(homeSpan.style.backgroundColor).toContain("rgba");
    expect(homeSpan.style.borderRadius).toBe("0.5rem");
  });

  it("applies contact button color, text color, opacity, and radius", () => {
    render(
      <HeaderFormPreview
        header={{
          ...mockHeader,
          contactButtonColor: "accent",
          contactButtonTextColor: "foreground",
          contactButtonOpacity: 64,
          contactButtonRadius: "rounded",
        }}
        brandKit={{ ...mockBrandKit, accentColor: "#007bff", foregroundColor: "#111111" }}
        workspaceName="Studio"
      />,
    );
    const contactButton = screen.getByText("Contact");
    expect(contactButton.style.backgroundColor).toContain("rgba");
    expect(contactButton.style.color).toBe("#111111");
    expect(contactButton.style.borderRadius).toBe("0.5rem");
  });

  it("does not apply highlight background when activeLinkHighlight is false", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, activeLinkHighlight: false, highlightColor: "#ff0000" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    expect(homeSpan.style.backgroundColor).toBeFalsy();
  });

  it("applies borderBottom to active link when activeLinkUnderline with token", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, activeLinkUnderline: true, underlineColor: "accent" }}
        brandKit={{ ...mockBrandKit, accentColor: "#007bff" }}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    expect(homeSpan.style.borderBottom).toContain("#007bff");
  });

  it("applies borderBottom to active link when activeLinkUnderline with custom hex", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, activeLinkUnderline: true, underlineColor: "#ff0000" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    expect(homeSpan.style.borderBottom).toContain("#ff0000");
  });

  it("applies underline borderBottom by default when activeLinkUnderline is unset (effective default ON)", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, underlineColor: "#ff0000" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    expect(homeSpan.style.borderBottom).toContain("#ff0000");
  });

  it("does not apply underline borderBottom when activeLinkUnderline is false", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, activeLinkUnderline: false, underlineColor: "#ff0000" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const homeSpan = screen.getByText("Home");
    // Base style sets "3px solid transparent" — should NOT contain the color
    expect(homeSpan.style.borderBottom).not.toContain("#ff0000");
  });

  it("shows the instructional caption", () => {
    render(<HeaderFormPreview header={mockHeader} brandKit={mockBrandKit} workspaceName="Studio" />);
    expect(screen.getByText(/"Home" shown as active to preview link styles/)).toBeTruthy();
  });

  it("brand text span has overflow:hidden and text-overflow:ellipsis for narrow preview widths", () => {
    render(<HeaderFormPreview header={mockHeader} brandKit={mockBrandKit} workspaceName="A Very Long Workspace Name That Could Overflow" />);
    const brandSpan = screen.getByText("A Very Long Workspace Name That Could Overflow");
    expect(brandSpan.style.overflow).toBe("hidden");
    expect(brandSpan.style.textOverflow).toBe("ellipsis");
  });

  it("uses the configured heading and body font variables", () => {
    render(<HeaderFormPreview header={mockHeader} brandKit={mockBrandKit} workspaceName="Studio" />);
    expect(screen.getByText("Studio").style.fontFamily).toBe("var(--pf-font-heading)");
    expect(screen.getByText("Gallery").style.fontFamily).toBe("var(--pf-font-body)");
  });

  it("uses fallback foreground color for linkColor when not set", () => {
    render(
      <HeaderFormPreview
        header={mockHeader}
        brandKit={{ ...mockBrandKit, foregroundColor: "#222222" }}
        workspaceName="Studio"
      />,
    );
    const gallerySpan = screen.getByText("Gallery");
    expect(gallerySpan.style.color).toBe("#222222");
  });

  it("uses secondary color token for linkColor", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, linkColor: "secondary" }}
        brandKit={{ ...mockBrandKit, secondaryColor: "#888888" }}
        workspaceName="Studio"
      />,
    );
    const gallerySpan = screen.getByText("Gallery");
    expect(gallerySpan.style.color).toBe("#888888");
  });

  it("uses background color token for linkColor", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, linkColor: "background" }}
        brandKit={{ ...mockBrandKit, backgroundColor: "#fafafa" }}
        workspaceName="Studio"
      />,
    );
    const gallerySpan = screen.getByText("Gallery");
    expect(gallerySpan.style.color).toBe("#fafafa");
  });

  it("applies borderBottom width and color from header config", () => {
    const { container } = render(
      <HeaderFormPreview
        header={{ ...mockHeader, borderBottomWidth: 2, borderBottomColor: "#ff0000" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />,
    );
    const headerEl = container.querySelector("[style*='border-bottom']") as HTMLElement;
    expect(headerEl).not.toBeNull();
    expect(headerEl.style.borderBottom).toContain("2px");
    expect(headerEl.style.borderBottom).toContain("#ff0000");
  });

  it("brandText trims whitespace before display and keeps the heading empty", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, brandText: "   " }}
        brandKit={mockBrandKit}
        workspaceName="Fallback Name"
      />,
    );
    expect(screen.queryByText("Fallback Name")).toBeNull();
  });

  it("keeps brand text empty when brandText is intentionally empty", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, brandText: "" }}
        brandKit={mockBrandKit}
        workspaceName="Fallback Name"
      />,
    );
    expect(screen.queryByText("Fallback Name")).toBeNull();
  });

  it("supports flashy navbar sizing in the inline preview", () => {
    render(
      <HeaderFormPreview
        header={{ ...mockHeader, navbarSize: "flashy" }}
        brandKit={mockBrandKit}
        workspaceName="Studio"
      />
    );

    expect(screen.getByText("Studio").style.fontSize).toBe("1.375rem");
    expect(screen.getByText("Contact").style.minHeight).toBe("52px");
  });
});
