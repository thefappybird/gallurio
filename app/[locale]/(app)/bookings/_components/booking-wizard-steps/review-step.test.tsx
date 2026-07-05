import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { ReviewStep } from "./review-step";
import type { WizardValues } from "./types";

const baseValues: WizardValues = {
  client: { mode: "new", name: "Test Client" },
  title: "Test Shoot",
  eventType: "portrait",
  status: "booked",
  sessions: [{ startDate: "2026-09-01", startTime: "10:00", endTime: "17:00", allowPastDate: false }],
  location: { address: "Test Venue", lat: null, lng: null },
  amount: { total: 500, deposit: 0, currency: "PHP" },
  payments: [{ price: 500, status: "paid" }],
  notes: "",
};

describe("ReviewStep — payments summary", () => {
  it("lists each payment's price and status", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ReviewStep values={baseValues} locale="en" />
      </NextIntlClientProvider>
    );

    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });
});
