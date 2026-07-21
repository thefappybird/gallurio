import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import { DemoDisclaimerBanner } from "./demo-disclaimer-banner";

function renderBanner() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DemoDisclaimerBanner />
    </NextIntlClientProvider>
  );
}

describe("DemoDisclaimerBanner", () => {
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
