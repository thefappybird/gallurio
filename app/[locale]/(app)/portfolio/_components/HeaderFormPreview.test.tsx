import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeaderFormPreview } from "./HeaderFormPreview";
import type {
  PortfolioBrandKit,
  PortfolioHeaderConfig,
} from "@/lib/page-builder/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
}));

const brandKit: PortfolioBrandKit = {
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

function renderPreview(header: PortfolioHeaderConfig = {}) {
  return render(
    <HeaderFormPreview
      header={header}
      brandKit={brandKit}
      workspaceName="My Studio"
    />,
  );
}

describe("HeaderFormPreview production-renderer parity", () => {
  it("renders the production navigation with clean preview paths", () => {
    renderPreview();
    expect(screen.getByRole("link", { name: "My Studio", hidden: true })).toHaveAttribute(
      "href",
      "/home",
    );
    expect(screen.getByRole("link", { name: "Home", hidden: true })).toHaveAttribute(
      "href",
      "/home",
    );
    expect(screen.getByRole("link", { name: "Gallery", hidden: true })).toHaveAttribute(
      "href",
      "/gallery",
    );
  });

  it("uses the same active-link underline fallback as the published header", () => {
    renderPreview();
    const home = screen.getByRole("link", { name: "Home", hidden: true });
    expect(home.getAttribute("style")).toContain("var(--pf-color-accent)");
  });

  it("uses the same 8% foreground highlight fallback as the published header", () => {
    renderPreview({ activeLinkHighlight: true });
    const home = screen.getByRole("link", { name: "Home", hidden: true });
    expect(home.getAttribute("style")).toContain(
      "--pf-active-link-highlight-fill: var(--pf-color-fg)",
    );
    expect(home.getAttribute("style")).toContain(
      "--pf-active-link-highlight-opacity: 8%",
    );
  });

  it("passes explicit header styling through unchanged", () => {
    renderPreview({
      brandText: "Custom Brand",
      navbarSize: "flashy",
      activeLinkScale: true,
      activeLinkUnderline: false,
      contactButtonColor: "accent",
      contactButtonTextColor: "foreground",
      contactButtonRadius: "rounded",
    });

    expect(screen.getByText("Custom Brand").closest("a")!.style.fontSize).toBe(
      "1.375rem",
    );
    const home = screen.getByRole("link", { name: "Home", hidden: true });
    expect(home.style.transform).toBe("scale(1.08)");
    expect(home.style.borderBottomColor).toBe("transparent");
    const contact = screen.getByRole("button", { name: "Contact", hidden: true });
    expect(contact.style.backgroundColor).toBe("var(--pf-color-accent)");
    expect(contact.style.color).toBe("var(--pf-color-fg)");
    expect(contact.style.borderRadius).toBe("0.5rem");
  });

  it("applies the selected brand kit through the portfolio CSS variables", () => {
    const { container } = renderPreview();
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--pf-color-primary")).toBe("#111111");
    expect(root.style.getPropertyValue("--pf-color-accent")).toBe("#007bff");
    expect(root.style.getPropertyValue("--pf-color-bg")).toBe("#ffffff");
    expect(root.style.getPropertyValue("--pf-color-fg")).toBe("#111111");
  });

  it("keeps the preview non-interactive and shows its active-link caption", () => {
    const { container } = renderPreview();
    expect((container.firstElementChild!.firstElementChild as HTMLElement).style.pointerEvents).toBe(
      "none",
    );
    expect(
      screen.getByText(/"Home" shown as active to preview link styles/),
    ).toBeInTheDocument();
  });
});
