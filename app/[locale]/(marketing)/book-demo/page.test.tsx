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
  });
});
