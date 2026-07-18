import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));

import ContactPage from "./page";

describe("Contact page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the contact header headline for an unauthenticated visitor", async () => {
    const page = await ContactPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByText("marketing.contact:header.headline")).toBeInTheDocument();
  });

  it("renders the small-startup business info copy without a legal name or address", async () => {
    const page = await ContactPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByText("marketing.contact:businessInfo.body")).toBeInTheDocument();
    expect(screen.queryByText(/legal name/i)).not.toBeInTheDocument();
  });

  it("renders the Instagram social link when its env var is set", async () => {
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL = "https://instagram.com/gallurio";
    const page = await ContactPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    const link = screen.getByLabelText("marketing.contact.social:instagram");
    expect(link).toHaveAttribute("href", "https://instagram.com/gallurio");

    delete process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL;
  });

  it("omits the Instagram social link when its env var is unset", async () => {
    const page = await ContactPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.queryByLabelText("marketing.contact.social:instagram")).not.toBeInTheDocument();
  });
});
