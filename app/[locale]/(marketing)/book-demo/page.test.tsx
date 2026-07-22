import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));

vi.mock("./_components/BookDemoForm", () => ({
  BookDemoForm: () => <div data-testid="book-demo-form" />,
}));

vi.mock("@/components/app/ambient-background", () => ({
  AmbientBackground: () => <div data-testid="ambient-background" />,
}));

import BookDemoPage from "./page";

describe("Book a Demo marketing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the headline and the demo form", async () => {
    const page = await BookDemoPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByText("marketing.bookDemo:header.headline")).toBeInTheDocument();
    expect(screen.getByTestId("book-demo-form")).toBeInTheDocument();
    expect(screen.getByTestId("book-demo-form-pane")).toContainElement(screen.getByTestId("ambient-background"));
    expect(screen.getByTestId("book-demo-form-card")).toHaveClass("max-w-sm", "border", "bg-card");
    expect(screen.getByTestId("book-demo-accent")).toHaveClass("bg-primary", "text-primary-foreground");
    expect(screen.getByText("marketing.manifesto:quote")).toBeInTheDocument();
    expect(screen.getByTestId("ambient-background")).toBeInTheDocument();
  });
});
