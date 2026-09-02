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

  it("resolves nav link hrefs from workspace.slug (independent of the slot)", () => {
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
    const home = within(nav).getByRole("link", { name: "Home" });
    const gallery = within(nav).getByRole("link", { name: "Gallery" });
    expect(home).toHaveAttribute("href", "/w/luna-studio");
    expect(gallery).toHaveAttribute("href", "/w/luna-studio/gallery");
  });

  it("uses live public hrefs when no preview override is supplied", () => {
    render(
      NavigationBlock({
        ...navigationDefaultProps,
        content: stubSlot,
        puck: {
          metadata: {
            workspace: { _id: "ws-5", name: "Luna Studio", slug: "luna-studio" },
          },
        },
      })
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/w/luna-studio");
    expect(screen.getByRole("link", { name: "Gallery" })).toHaveAttribute(
      "href",
      "/w/luna-studio/gallery"
    );
  });

  it("uses the preview override hrefs when workspace.previewNav is set (stays inside the iframe)", () => {
    render(
      NavigationBlock({
        ...navigationDefaultProps,
        content: stubSlot,
        puck: {
          metadata: {
            workspace: {
              _id: "ws-6",
              name: "Luna Studio",
              slug: "luna-studio",
              previewNav: {
                homeHref: "/en/portfolio-preview?zone=home",
                galleryHref: "/en/portfolio-preview?zone=gallery",
                activePath: "/en/portfolio-preview?zone=gallery",
              },
            },
          },
        },
      })
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/en/portfolio-preview?zone=home"
    );
    expect(screen.getByRole("link", { name: "Gallery" })).toHaveAttribute(
      "href",
      "/en/portfolio-preview?zone=gallery"
    );
  });

  it("marks the current preview zone's link active via previewNav.activePath, not usePathname", () => {
    render(
      NavigationBlock({
        ...navigationDefaultProps,
        // activeLinkScale makes the active link's style visibly diverge
        // (fontWeight 700) so the assertion doesn't depend on color tokens
        // that happen to match the inactive default.
        activeLinkScale: true,
        content: stubSlot,
        puck: {
          metadata: {
            workspace: {
              _id: "ws-7",
              name: "Luna Studio",
              slug: "luna-studio",
              previewNav: {
                homeHref: "/en/portfolio-preview?zone=home",
                galleryHref: "/en/portfolio-preview?zone=gallery",
                activePath: "/en/portfolio-preview?zone=gallery",
              },
            },
          },
        },
      })
    );
    // usePathname() is mocked to "/w/luna-studio" — if activePath weren't
    // threaded through, neither link would resolve as current.
    expect(screen.getByRole("link", { name: "Gallery" }).getAttribute("style")).toContain(
      "font-weight: 700"
    );
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("style")).not.toContain(
      "font-weight: 700"
    );
  });

  it("renders the content slot as the brand region, in the SAME row as the nav links", () => {
    render(
      NavigationBlock({
        ...navigationDefaultProps,
        content: stubSlot,
        puck: {
          metadata: {
            workspace: { _id: "ws-4", name: "Luna Studio", slug: "luna-studio" },
          },
        },
      })
    );
    const nav = screen.getByRole("navigation", { name: "Portfolio" });
    expect(within(nav).getByTestId("nav-slot")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("gives the logo and company-title slot the full available width", () => {
    const { container } = render(NavigationBlock({ ...navigationDefaultProps, content: stubSlot }));
    const slot = screen.getByTestId("nav-slot");
    expect(slot).toHaveClass("pf-nav-brand-content");
    expect(slot).toHaveStyle({ width: "100%", minWidth: 0 });
    expect(slot.parentElement).toHaveStyle({ width: "100%", minWidth: 0 });
    expect(container.querySelector("style")?.textContent).toContain("white-space: nowrap");
  });

  it("caps a nested Image block at 75px high inside the navigation", () => {
    const { container } = render(NavigationBlock({ ...navigationDefaultProps, content: stubSlot }));
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain('.pf-nav-brand-content [data-block="image"]');
    expect(css).toContain("max-height: 75px !important");
  });

  it("calls the content slot function and renders its output", () => {
    render(NavigationBlock({ ...navigationDefaultProps, content: stubSlot }));
    expect(screen.getByTestId("nav-slot")).toBeInTheDocument();
  });

  it("keeps nav links and the contact button when the slot renders empty", () => {
    const emptySlot: SlotComponent = () => null;
    render(NavigationBlock({ ...navigationDefaultProps, content: emptySlot }));
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gallery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contact" })).toBeInTheDocument();
  });
});

describe("NavigationBlock — defaults and permissions", () => {
  it("defaultProps carry _chrome: 'nav' and a seeded title slot, no placeholder logo", () => {
    expect(navigationDefaultProps._chrome).toBe("nav");
    // No Image child — an empty Image renders an "Image unavailable" placeholder
    // on the public page. Owner adds a logo Image block once they have one.
    expect(navigationDefaultProps.content).toEqual([
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

  it("navigationFields carries a round-trip-only `_style` key (production placeholder)", () => {
    const fields = navigationBlockConfig.fields as unknown as {
      _style?: { type: string; render: (...args: unknown[]) => unknown };
    };
    expect(fields._style).toBeDefined();
    expect(fields._style?.type).toBe("custom");
    // Production placeholder renders null — the real editing UI is an
    // editor-only `_style` override (see the file's header comment).
    expect(fields._style?.render()).toBeNull();
  });
});
