import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { LocalPriceNote } from "./local-price-note";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("LocalPriceNote", () => {
  it("shows the converted amount alongside the currency actually billed", () => {
    render(<LocalPriceNote amount={4.3} currency="USD" billedIn="PHP" />, { wrapper });

    expect(screen.getByText(/\$4\.30/)).toBeInTheDocument();
    expect(screen.getByText(/billed in PHP/)).toBeInTheDocument();
  });
});
