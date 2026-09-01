import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { SlotComponent } from "@measured/puck";
import {
  NavigationBlock,
  navigationDefaultProps,
  navigationBlockConfig,
} from "./NavigationBlock";

vi.mock("next/navigation", () => ({
  usePathname: () => "/w/luna-studio",
}));

const stubSlot: SlotComponent = (slotProps) => <div data-testid="nav-slot" {...slotProps} />;

describe("NavigationBlock — isomorphic render", () => {
  it("is a synchronous (non-async) component", () => {
    const out = NavigationBlock({ ...navigationDefaultProps, content: stubSlot });
    expect(out).not.toBeInstanceOf(Promise);
  });

  it("renders PortfolioHeader from its own props (config passthrough)", () => {
    render(
      NavigationBlock({
        ...navigationDefaultProps,
        content: stubSlot,
        contactButtonColor: "accent",
        contactButtonOpacity: 64,
      })
    );
    const contact = screen.getByRole("button", { name: "Contact" });
    expect(contact.getAttribute("style")).toContain("--pf-contact-button-fill: var(--pf-color-accent)");
    expect(contact.getAttribute("style")).toContain("--pf-contact-button-opacity: 64%");
  });

  it("resolves nav labels from puck.metadata.workspace.chrome.nav, English fallback otherwise", () => {
    render(
      NavigationBlock({
        ...navigationDefaultProps,
        content: stubSlot,
        puck: {
          metadata: {
            workspace: { _id: "ws-1", name: "Luna Studio", slug: "luna-studio" },
          },
        },
      })
    );
    // English fallback labels — no chrome.nav override supplied.
    expect(screen.getByRole("navigation", { name: "Portfolio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gallery" })).toBeInTheDocument();
  });

  it("overrides nav labels from puck.metadata.workspace.chrome.nav", () => {
    render(
      NavigationBlock({
        ...navigationDefaultProps,
        content: stubSlot,
        puck: {
          metadata: {
            workspace: {
              _id: "ws-2",
              name: "Luna Studio",
              slug: "luna-studio",
              chrome: { nav: { home: "Simula", gallery: "Koleksyon" } },
            },
          },
        },
      })
    );
    expect(screen.getByRole("link", { name: "Simula" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Koleksyon" })).toBeInTheDocument();
  });

  it("resolves the brand link from workspace.name and hrefs from workspace.slug", () => {
    render(
      NavigationBlock({
        ...navigationDefaultProps,
        content: stubSlot,
        puck: {
          metadata: {
            workspace: { _id: "ws-3", name: "Luna Studio", slug: "luna-studio" },
          },
        },
      })
    );
    const nav = screen.getByRole("navigation", { name: "Portfolio" });
    const home = within(nav).getByRole("link", { name: "Luna Studio" });
    const gallery = within(nav).getByRole("link", { name: "Gallery" });
    expect(home).toHaveAttribute("href", "/w/luna-studio");
    expect(gallery).toHaveAttribute("href", "/w/luna-studio/gallery");
  });

  it("calls the content slot function and renders its output", () => {
    render(NavigationBlock({ ...navigationDefaultProps, content: stubSlot }));
    expect(screen.getByTestId("nav-slot")).toBeInTheDocument();
  });
});

describe("NavigationBlock — defaults and permissions", () => {
  it("defaultProps carry _chrome: 'nav' and a seeded logo + title slot", () => {
    expect(navigationDefaultProps._chrome).toBe("nav");
    expect(navigationDefaultProps.content).toEqual([
      { type: "Image", props: { alt: "Logo" } },
      { type: "Heading", props: { level: "h3", text: "Studio Name" } },
    ]);
  });

  it("navigationBlockConfig carries { delete: false, duplicate: false, drag: false }", () => {
    expect(navigationBlockConfig.permissions).toEqual({
      delete: false,
      duplicate: false,
      drag: false,
    });
  });

  it("navigationBlockConfig does not restrict insert/edit", () => {
    expect(navigationBlockConfig.permissions?.insert).toBeUndefined();
    expect(navigationBlockConfig.permissions?.edit).toBeUndefined();
  });
});
