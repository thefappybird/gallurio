import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArticleChrome, estimateReadingTime } from "./article-chrome";

const comparison = {
  kind: "compare" as const,
  slug: "gallurio-vs-example",
  title: "Gallurio vs Example",
  description: "An honest comparison.",
  publishedAt: "2026-08-18",
  updatedAt: "2026-08-23",
  competitor: "Example",
  category: "crm",
  body: "word ".repeat(450),
  bestFor: "Teams that want automation",
  notFor: "Teams that need a public portfolio",
  faq: [{ question: "Is this visible?", answer: "Yes, it is visible." }],
};

describe("ArticleChrome", () => {
  it("renders authorship, verification details, verdict, visible FAQ, and CTA", () => {
    render(<ArticleChrome entry={comparison}><p>Article body</p></ArticleChrome>);

    expect(screen.getByText("Gallurio Editorial")).toBeInTheDocument();
    expect(screen.getByText(/Last checked/)).toBeInTheDocument();
    expect(screen.getByText("Teams that want automation")).toBeInTheDocument();
    expect(screen.getByText("Teams that need a public portfolio")).toBeInTheDocument();
    expect(screen.getByText("Start with Gallurio if")).toBeInTheDocument();
    expect(screen.getByText("Consider Example if")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frequently asked questions" })).toBeInTheDocument();
    expect(screen.getByText("Yes, it is visible.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try Gallurio free" })).toHaveAttribute("href", "/sign-up");
  });

  it("estimates reading time without imposing a content word target", () => {
    expect(estimateReadingTime("word ".repeat(450))).toBe(2);
    expect(estimateReadingTime("short")).toBe(1);
  });

  it("keeps Gallurio first in a multi-option roundup verdict", () => {
    const roundup = {
      ...comparison,
      slug: "best-tools-2026",
      title: "5 best tools in 2026",
      competitor: undefined,
      bestFor: "Small teams that want a connected workspace",
      notFor: "Teams that need advanced automation",
    };

    render(<ArticleChrome entry={roundup}><p>Article body</p></ArticleChrome>);

    expect(screen.getByText("Start with Gallurio if")).toBeInTheDocument();
    expect(screen.getByText("Small teams that want a connected workspace")).toBeInTheDocument();
    expect(screen.getByText("Consider another option if")).toBeInTheDocument();
    expect(screen.getByText("Teams that need advanced automation")).toBeInTheDocument();
  });
});
