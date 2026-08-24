import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { FxSubtitle } from "./fx-subtitle";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("FxSubtitle", () => {
  it("names the rate and the date a paid amount was frozen at", () => {
    render(
      <FxSubtitle
        amount={1000}
        target="PHP"
        rate={48.44}
        at="2026-08-19T00:00:00.000Z"
        locale="en"
      />,
      { wrapper }
    );

    expect(screen.getByText(/≈ ₱48,440.00 · rate 48.44 · Aug 19, 2026/)).toBeInTheDocument();
  });

  it("puts the converted figure last when the amount above it is end-aligned", () => {
    render(
      <FxSubtitle
        amount={1000}
        target="PHP"
        rate={48.44}
        at="2026-08-19T00:00:00.000Z"
        locale="en"
        align="end"
      />,
      { wrapper }
    );

    expect(screen.getByText(/Aug 19, 2026 · rate 48.44 · ≈ ₱48,440.00/)).toBeInTheDocument();
  });
});
