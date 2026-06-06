import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ContactFormPreview } from "./ContactFormPreview";
import type { PortfolioBrandKit, PortfolioContactConfig } from "@/lib/page-builder/types";

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

const mockContact: PortfolioContactConfig = {
  title: "Work with us",
  description: "Tell us about your event",
  buttonStyle: "solid",
  buttonColor: "primary",
  backgroundColor: "background",
};

describe("ContactFormPreview", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ContactFormPreview
        contact={mockContact}
        brandKit={mockBrandKit}
        defaultTitle="Default Title"
        defaultDescription="Default description"
        submitLabel="Send inquiry"
      />,
    );
    expect(container).toBeTruthy();
  });

  it("shows contact.title when set", () => {
    render(
      <ContactFormPreview
        contact={mockContact}
        brandKit={mockBrandKit}
        defaultTitle="Fallback"
        defaultDescription=""
        submitLabel="Send"
      />,
    );
    expect(screen.getByText("Work with us")).toBeTruthy();
  });

  it("falls back to defaultTitle when contact.title is empty", () => {
    render(
      <ContactFormPreview
        contact={{ ...mockContact, title: "" }}
        brandKit={mockBrandKit}
        defaultTitle="Fallback Title"
        defaultDescription=""
        submitLabel="Send"
      />,
    );
    expect(screen.getByText("Fallback Title")).toBeTruthy();
  });

  it("shows the submit label", () => {
    render(
      <ContactFormPreview
        contact={mockContact}
        brandKit={mockBrandKit}
        defaultTitle="Title"
        defaultDescription=""
        submitLabel="Send inquiry"
      />,
    );
    expect(screen.getByText("Send inquiry")).toBeTruthy();
  });

  it("applies solid popup style by default (border on container)", () => {
    const { container } = render(
      <ContactFormPreview
        contact={{ ...mockContact, popupStyle: undefined }}
        brandKit={mockBrandKit}
        defaultTitle="Title"
        defaultDescription=""
        submitLabel="Send"
      />,
    );
    // The popup div is the z-10 element
    const popup = container.querySelector(".z-10") as HTMLElement;
    expect(popup).not.toBeNull();
    // Solid style sets a border
    expect(popup.style.border).toContain("1px solid");
  });

  it("applies soft popup style (box-shadow, no border)", () => {
    const { container } = render(
      <ContactFormPreview
        contact={{ ...mockContact, popupStyle: "soft" }}
        brandKit={mockBrandKit}
        defaultTitle="Title"
        defaultDescription=""
        submitLabel="Send"
      />,
    );
    const popup = container.querySelector(".z-10") as HTMLElement;
    expect(popup.style.boxShadow).toBeTruthy();
    expect(popup.style.border).toBe("");
  });

  it("applies textColor from contact config to popup text", () => {
    const { container } = render(
      <ContactFormPreview
        contact={{ ...mockContact, textColor: "accent" }}
        brandKit={{ ...mockBrandKit, accentColor: "#007bff" }}
        defaultTitle="Title"
        defaultDescription=""
        submitLabel="Send"
      />,
    );
    const popup = container.querySelector(".z-10") as HTMLElement;
    expect(popup.style.color).toBe("#007bff");
  });

  it("falls back to foregroundColor when textColor is not set", () => {
    const { container } = render(
      <ContactFormPreview
        contact={{ ...mockContact, textColor: undefined }}
        brandKit={{ ...mockBrandKit, foregroundColor: "#111111" }}
        defaultTitle="Title"
        defaultDescription=""
        submitLabel="Send"
      />,
    );
    const popup = container.querySelector(".z-10") as HTMLElement;
    expect(popup.style.color).toBe("#111111");
  });

  it("applies brandKit.radius to popup and button when no per-element radius set", () => {
    const { container } = render(
      <ContactFormPreview
        contact={mockContact}
        brandKit={{ ...mockBrandKit, radius: "rounded" }}
        defaultTitle="Title"
        defaultDescription=""
        submitLabel="Send"
      />,
    );
    const popup = container.querySelector(".z-10") as HTMLElement;
    expect(popup.style.borderRadius).toBe("0.5rem");
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.style.borderRadius).toBe("0.5rem");
  });

  it("overrides popup radius independently of button radius", () => {
    const { container } = render(
      <ContactFormPreview
        contact={{ ...mockContact, popupRadius: "rounded", buttonRadius: "sharp" }}
        brandKit={mockBrandKit}
        defaultTitle="Title"
        defaultDescription=""
        submitLabel="Send"
      />,
    );
    const popup = container.querySelector(".z-10") as HTMLElement;
    expect(popup.style.borderRadius).toBe("0.5rem");
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.style.borderRadius).toBe("0px");
  });

  it("applies buttonTextColor to button text", () => {
    const { container } = render(
      <ContactFormPreview
        contact={{ ...mockContact, buttonTextColor: "accent" }}
        brandKit={{ ...mockBrandKit, accentColor: "#007bff" }}
        defaultTitle="Title"
        defaultDescription=""
        submitLabel="Send"
      />,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.style.color).toBe("#007bff");
  });

  it("applies outline button style (transparent background)", () => {
    const { container } = render(
      <ContactFormPreview
        contact={{ ...mockContact, buttonStyle: "outline" }}
        brandKit={mockBrandKit}
        defaultTitle="Title"
        defaultDescription=""
        submitLabel="Send"
      />,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.style.backgroundColor).toBe("transparent");
    expect(button.style.border).toContain("2px solid");
  });
});
