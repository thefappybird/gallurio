import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BilledAsNote } from "./billed-as-note";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("BilledAsNote", () => {
  it("names the amount and currency the card is actually charged", () => {
    render(<BilledAsNote amount={250} currency="PHP" />, { wrapper });

    expect(screen.getByText(/Billed as ₱250 PHP/)).toBeInTheDocument();
  });
});
