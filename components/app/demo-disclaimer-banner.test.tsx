import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import { DEMO_PROMO_CLAIMED_EVENT, markDemoPromoClaimed } from "@/lib/page-builder/demoSession";
import { DemoDisclaimerBanner } from "./demo-disclaimer-banner";

function renderBanner() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DemoDisclaimerBanner />
    </NextIntlClientProvider>
  );
}

describe("DemoDisclaimerBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the bonus-code line when the promo is already claimed at mount", () => {
    markDemoPromoClaimed();
    renderBanner();
    expect(screen.getByText(/DEMOPRO2026/)).toBeInTheDocument();
  });

  it("does not render the bonus-code line when the promo is unclaimed", () => {
    renderBanner();
    expect(screen.queryByText(/DEMOPRO2026/)).not.toBeInTheDocument();
  });

  it("renders the bonus-code line after DEMO_PROMO_CLAIMED_EVENT fires post-mount, without a remount", () => {
    renderBanner();
    expect(screen.queryByText(/DEMOPRO2026/)).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(DEMO_PROMO_CLAIMED_EVENT));
    });

    expect(screen.getByText(/DEMOPRO2026/)).toBeInTheDocument();
  });

  it("renders the demo disclaimer message in a status landmark", () => {
    renderBanner();
    expect(
      screen.getByText(/nothing you do here is saved to a database/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders no dismiss control — the disclaimer stays visible for the whole session", () => {
    renderBanner();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
