import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { PortfolioLanguageControl } from "./PortfolioLanguageControl";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("PortfolioLanguageControl", () => {
  it("renders 5 locale options with native labels and calls onChange", async () => {
    const onChange = vi.fn();
    render(
      <PortfolioLanguageControl value="" onChange={onChange} dir="ltr" onDirChange={vi.fn()} />,
      { wrapper }
    );

    // Open the dropdown
    const trigger = screen.getByTestId("language-control");
    fireEvent.click(trigger);

    // All 5 locale labels must be visible
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Filipino")).toBeInTheDocument();
    expect(screen.getByText("Bahasa Indonesia")).toBeInTheDocument();
    expect(screen.getByText("العربية")).toBeInTheDocument();
    expect(screen.getByText("ภาษาไทย")).toBeInTheDocument();

    // Clicking a locale calls onChange
    fireEvent.click(screen.getByText("Filipino"));
    expect(onChange).toHaveBeenCalledWith("fil");
  });

  it("does not show RTL/LTR toggle when value is 'ar'", () => {
    render(
      <PortfolioLanguageControl value="ar" onChange={vi.fn()} dir="rtl" onDirChange={vi.fn()} />,
      { wrapper }
    );
    expect(screen.queryByRole("button", { name: /Right to left/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Left to right/i })).toBeNull();
  });
});
