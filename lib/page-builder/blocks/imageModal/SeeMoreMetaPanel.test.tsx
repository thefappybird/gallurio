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
    expect(panel!.style.background).toContain("rgba(0, 0, 0, 0.5)");
    expect(panel!.style.backdropFilter).toBe("blur(6px)");
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
