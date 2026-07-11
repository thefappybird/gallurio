import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));

import RefundsPage from "./page";

describe("Refunds page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the refunds title for an unauthenticated visitor", async () => {
    const page = await RefundsPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByText("marketing.refunds:title")).toBeInTheDocument();
  });
});
