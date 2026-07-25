import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));

import AboutPage, { generateMetadata } from "./page";

describe("About page", () => {
  it("states Gallurio's purpose and optional Google Sign-In data use", async () => {
    const page = await AboutPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByText("marketing.appInfo:headline")).toBeInTheDocument();
    expect(screen.getByText("marketing.appInfo:purpose.body")).toBeInTheDocument();
    expect(screen.getByText("marketing.appInfo:googleSignIn.body")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "marketing.appInfo:legal.privacy" })).toHaveAttribute("href", "/privacy");
  });

  it("publishes an app-information title and description", async () => {
    await generateMetadata({ params: Promise.resolve({ locale: "en" }) });

    expect(vi.mocked(await import("next-intl/server")).getTranslations).toHaveBeenCalledWith({
      locale: "en",
      namespace: "marketing.appInfo.metadata",
    });
  });
});
