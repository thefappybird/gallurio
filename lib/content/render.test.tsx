import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { listEntries } from "./entries";
import { renderContent } from "./render";

describe("renderContent()", () => {
  it("renders GFM pipe tables as real table elements", async () => {
    const body = `
| | Gallurio | HoneyBook |
| --- | --- | --- |
| Monthly | cheap | $36/mo |
`;

    render(await renderContent(body, {}));

    // The comparison pages are built on pipe tables. @mdx-js/mdx has no table
    // support without remark-gfm, so this asserts the plugin is actually wired.
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "$36/mo" })).toBeInTheDocument();
  });

  it("substitutes components supplied by the caller", async () => {
    const components = { GallurioPrice: () => <span>PHP 250/mo</span> };

    render(await renderContent("Costs <GallurioPrice /> today.", components));

    expect(screen.getByText("PHP 250/mo")).toBeInTheDocument();
  });

  it("renders headings as real heading elements", async () => {
    render(await renderContent("## The short version", {}));

    expect(screen.getByRole("heading", { level: 2, name: "The short version" })).toBeInTheDocument();
  });

  it("compiles every published guide and comparison with the shared MDX components", async () => {
    const components = {
      GallurioPrice: () => <span>Current price</span>,
      ProductShot: ({ id }: { id: string }) => <figure>{id}</figure>,
      YouTubeEmbed: ({ title }: { title: string }) => <div>{title}</div>,
    };

    for (const entry of [...listEntries("blog"), ...listEntries("compare")]) {
      await expect(renderContent(entry.body, components), entry.slug).resolves.toBeTruthy();
    }
  });
});
