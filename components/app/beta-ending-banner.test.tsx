import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import { BetaEndingBanner } from "./beta-ending-banner";

const END_DATE = "2026-08-01T00:00:00.000Z";

function renderBanner() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BetaEndingBanner scheduledEndAt={END_DATE} />
    </NextIntlClientProvider>
  );
}

afterEach(() => window.sessionStorage.clear());

describe("BetaEndingBanner", () => {
  it("hides after dismissal for the current browser session", () => {
    renderBanner();
    expect(screen.getByText("Beta access is ending soon")).toBeInTheDocument();
    expect(screen.getByText(/Thank you for being part of the Gallurio Beta/)).toBeInTheDocument();
    expect(screen.getByText("BETA2PRO")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss for this session" }));
    expect(screen.queryByText("Beta access is ending soon")).not.toBeInTheDocument();
  });

  it("honors a prior dismissal for the scheduled end date", () => {
    window.sessionStorage.setItem(`gw_beta_ending_banner_dismissed:${END_DATE}`, "true");
    renderBanner();
    expect(screen.queryByText("Beta access is ending soon")).not.toBeInTheDocument();
  });
});
