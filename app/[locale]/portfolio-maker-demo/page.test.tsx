import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock("../(app)/portfolio/_components/EditorShell", () => ({
  EditorShell: ({ demoMode }: { demoMode?: boolean }) => (
    <div data-testid="editor-shell" data-demo-mode={String(Boolean(demoMode))} />
  ),
}));

vi.mock("@/components/app/demo-disclaimer-banner", () => ({
  DemoDisclaimerBanner: () => <div data-testid="demo-disclaimer-banner" />,
}));

vi.mock("./demo-guide-chrome", () => ({
  DemoGuideChrome: ({ children }: { children: ReactNode }) => (
    <div data-testid="demo-guide-chrome">{children}</div>
  ),
}));

import PortfolioMakerDemoPage from "./page";

describe("PortfolioMakerDemoPage", () => {
  it("renders the demo disclaimer banner and EditorShell in demoMode", async () => {
    const page = await PortfolioMakerDemoPage({
      params: Promise.resolve({ locale: "en" }),
    });
    render(page);

    expect(screen.getByTestId("demo-guide-chrome")).toBeInTheDocument();
    const shell = screen.getByTestId("editor-shell");
    expect(shell).toBeInTheDocument();
    expect(shell).toHaveAttribute("data-demo-mode", "true");

    expect(shell.parentElement).toHaveAttribute("data-testid", "demo-guide-chrome");
    expect(shell.parentElement).not.toHaveClass("-m-6");
  });
});
