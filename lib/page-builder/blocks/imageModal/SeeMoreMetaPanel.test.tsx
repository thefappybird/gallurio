import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeeMoreMetaPanel } from "./SeeMoreMetaPanel";

const labels = { seeMoreLabel: "See more", seeLessLabel: "See less" };

describe("SeeMoreMetaPanel", () => {
  it("renders null when facts, meta, and tags are all empty", () => {
    const { container } = render(
      <SeeMoreMetaPanel facts={[]} meta={[]} tags={[]} {...labels} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("toggles expanded state and aria-expanded on click", () => {
    render(
      <SeeMoreMetaPanel
        facts={[{ label: "Date", value: "2024-01-01" }]}
        meta={[]}
        tags={[]}
        {...labels}
      />,
    );
    const button = screen.getByRole("button", { name: "See more" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "See less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "See less" }));
    expect(screen.getByRole("button", { name: "See more" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("renders facts, meta, and tags when expanded", () => {
    render(
      <SeeMoreMetaPanel
        facts={[{ label: "Date", value: "2024-01-01" }]}
        meta={[{ label: "Camera", value: "Sony A7IV" }]}
        tags={["wedding", "outdoor"]}
        {...labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "See more" }));

    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("2024-01-01")).toBeInTheDocument();
    expect(screen.getByText("Camera")).toBeInTheDocument();
    expect(screen.getByText("Sony A7IV")).toBeInTheDocument();
    expect(screen.getByText("wedding")).toBeInTheDocument();
    expect(screen.getByText("outdoor")).toBeInTheDocument();
  });

  it("groups primary and additional information into a centered, capped two-column grid", () => {
    render(
      <SeeMoreMetaPanel
        title="Golden hour"
        description="A couple walking at sunset"
        facts={[{ label: "Date", value: "2026-09-06" }]}
        meta={[{ label: "Camera", value: "Sony A7IV" }]}
        tags={["wedding"]}
        additionalInformationLabel="Additional information"
        {...labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "See more" }));

    const primary = document.querySelector('[data-meta-column="primary"]');
    const additional = document.querySelector('[data-meta-column="additional"]');
    const grid = document.querySelector(".pf-photo-meta-grid") as HTMLElement;

    expect(primary).toContainElement(screen.getByText("Golden hour"));
    expect(primary).toContainElement(screen.getByText("A couple walking at sunset"));
    expect(primary).toContainElement(screen.getByText("wedding"));
    expect(primary).not.toContainElement(screen.getByText("Date"));
    expect(additional).toContainElement(screen.getByText("Additional information"));
    expect(additional).toContainElement(screen.getByText("Date"));
    expect(additional).toContainElement(screen.getByText("Camera"));
    expect(additional).not.toContainElement(screen.getByText("wedding"));
    expect(grid.style.width).toBe("100%");
    expect(grid.style.maxWidth).toBe("700px");
    expect(grid.style.marginInline).toBe("auto");
    expect(grid.parentElement?.querySelector("style")?.textContent).toContain(
      "repeat(2, minmax(0, 1fr))",
    );
  });

  it("uses the portfolio theme fonts for body copy and headings", () => {
    render(
      <SeeMoreMetaPanel
        title="Golden hour"
        facts={[{ label: "Date", value: "2026-09-06" }]}
        meta={[]}
        tags={[]}
        additionalInformationLabel="Additional information"
        {...labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "See more" }));

    const panelId = screen
      .getByRole("button", { name: "See less" })
      .getAttribute("aria-controls");
    const panel = document.getElementById(panelId!);
    expect(panel?.style.fontFamily).toBe("var(--pf-font-body)");
    expect(screen.getByRole("heading", { name: "Golden hour" }).style.fontFamily).toBe(
      "var(--pf-font-heading)",
    );
    expect(
      screen.getByRole("heading", { name: "Additional information" }).style.fontFamily,
    ).toBe("var(--pf-font-heading)");
  });

  it("repeats the complete photo information from title and description and animates upward", () => {
    render(
      <SeeMoreMetaPanel
        title="Golden hour"
        description="A couple walking at sunset"
        facts={[{ label: "Date", value: "2026-09-06" }]}
        meta={[]}
        tags={[]}
        {...labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "See more" }));
    expect(screen.getByText("Golden hour")).toBeInTheDocument();
    expect(screen.getByText("A couple walking at sunset")).toBeInTheDocument();
    const panelId = screen.getByRole("button", { name: "See less" }).getAttribute("aria-controls");
    const panel = document.getElementById(panelId!)!;
    expect(panel.style.bottom).toContain("100%");
    expect(panel.style.animation).toContain("pf-photo-meta-expand");
  });

  it("bounds the expanded panel with an internal scrollbar and a capped max-height", () => {
    render(
      <SeeMoreMetaPanel
        facts={[{ label: "Date", value: "2024-01-01" }]}
        meta={[]}
        tags={[]}
        {...labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "See more" }));

    const panelId = screen.getByRole("button", { name: "See less" }).getAttribute(
      "aria-controls",
    );
    const panel = document.getElementById(panelId!);
    expect(panel).not.toBeNull();
    expect(panel!.style.maxHeight).toBe("min(320px, 60vh)");
    expect(panel!.style.overflowY).toBe("auto");
  });

  it("gives the panel itself the scrim background, with no separate backing layer", () => {
    render(
      <SeeMoreMetaPanel
        facts={[{ label: "Date", value: "2024-01-01" }]}
        meta={[]}
        tags={[]}
        {...labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "See more" }));

    const panelId = screen.getByRole("button", { name: "See less" }).getAttribute("aria-controls");
    const panel = document.getElementById(panelId!);
    expect(panel).not.toBeNull();
    expect(panel!.style.background).toContain("rgba(0, 0, 0, 0.62)");
    expect(panel!.style.backdropFilter).toBe("blur(12px)");
    // No separate aria-hidden scrim sibling — the panel carries its own background.
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it("wires aria-controls to the panel id and aria-expanded reflects collapsed state", () => {
    render(
      <SeeMoreMetaPanel
        facts={[]}
        meta={[]}
        tags={["solo"]}
        {...labels}
      />,
    );
    const button = screen.getByRole("button", { name: "See more" });
    expect(button).toHaveAttribute("aria-controls");
    // Collapsed: panel not in the DOM.
    const panelId = button.getAttribute("aria-controls")!;
    expect(document.getElementById(panelId)).toBeNull();
  });
});
