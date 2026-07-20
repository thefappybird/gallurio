import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "en"),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));

const getAuthUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUserMock(),
}));

import NotFound from "./not-found";

describe("Locale NotFound page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links to the dashboard for an authenticated visitor", async () => {
    getAuthUserMock.mockResolvedValue({ workosUserId: "user_1" });
    const page = await NotFound();
    render(<NextIntlClientProvider locale="en" messages={enMessages}>{page}</NextIntlClientProvider>);

    const cta = screen.getByRole("link", { name: "notFound:backToDashboard" });
    expect(cta).toHaveAttribute("href", "/dashboard");
  });

  it("links to the marketing home for an unauthenticated visitor", async () => {
    getAuthUserMock.mockResolvedValue(null);
    const page = await NotFound();
    render(<NextIntlClientProvider locale="en" messages={enMessages}>{page}</NextIntlClientProvider>);

    const cta = screen.getByRole("link", { name: "notFound:backToHome" });
    expect(cta).toHaveAttribute("href", "/");
  });

  it("does not use font-serif for the heading", async () => {
    getAuthUserMock.mockResolvedValue(null);
    const page = await NotFound();
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>{page}</NextIntlClientProvider>
    );

    const heading = container.querySelector("h1");
    expect(heading?.className).not.toContain("font-serif");
  });
});
