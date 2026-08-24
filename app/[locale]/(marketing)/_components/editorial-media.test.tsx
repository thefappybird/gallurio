import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { listEntries } from "@/lib/content/entries";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

import { ProductShot } from "./editorial-media";

describe("ProductShot", () => {
  it("renders a crawlable product image with a Gallurio subtitle and specific caption", () => {
    render(<ProductShot id="dashboard-overview" />);

    expect(screen.getByRole("img", { name: /Gallurio dashboard showing revenue/ })).toHaveAttribute(
      "src",
      "/marketing/editorial/dashboard-overview.png",
    );
    expect(screen.getByText("Gallurio dashboard")).toBeInTheDocument();
    expect(screen.getByText(/Revenue, upcoming work, and recent activity/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open full-size/ })).toHaveAttribute(
      "href",
      "/marketing/editorial/dashboard-overview.png",
    );
  });

  it("has a published asset for every product shot referenced by an article", () => {
    const entries = [...listEntries("blog"), ...listEntries("compare")];

    for (const entry of entries) {
      const ids = [...entry.body.matchAll(/<ProductShot id="([^"]+)" \/>/g)].map((match) => match[1]);
      for (const id of ids) {
        const asset = path.join(process.cwd(), "public", "marketing", "editorial", `${id}.png`);
        expect(existsSync(asset), `${entry.slug} references missing product shot ${id}`).toBe(true);
      }
    }
  });
});
