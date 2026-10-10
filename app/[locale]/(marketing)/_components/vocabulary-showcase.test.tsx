import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { enMessages } from "@/test-utils/messages";
import { SHOWCASE_CYCLE_MS, VocabularyShowcase } from "./vocabulary-showcase";

function setReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderShowcase() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <VocabularyShowcase />
    </NextIntlClientProvider>,
  );
}

const checked = () => screen.getByRole("radio", { checked: true }).textContent;

beforeEach(() => {
  vi.useFakeTimers();
  setReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("VocabularyShowcase", () => {
  it("flips the sidebar labels to the picked business type's words", () => {
    renderShowcase();
    expect(screen.getAllByText("Events").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("radio", { name: "Catering" }));

    expect(screen.getAllByText("Orders").length).toBeGreaterThan(0);
    expect(screen.queryByText("Events")).toBeNull();
    // Universal items never change.
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
  });

  it("renders the final state with no autoplay or timer bar under reduced motion", () => {
    setReducedMotion(true);
    renderShowcase();
    const first = checked();

    expect(screen.getAllByText("Events").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("vocabulary-progress")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(SHOWCASE_CYCLE_MS * 3);
    });
    expect(checked()).toBe(first);
  });

  it("autoplays through types while idle, then stops once the visitor picks one", () => {
    renderShowcase();
    expect(checked()).toBe("Venue");

    act(() => {
      vi.advanceTimersByTime(SHOWCASE_CYCLE_MS);
    });
    expect(checked()).toBe("Planner");

    fireEvent.click(screen.getByRole("radio", { name: "Stylist" }));
    act(() => {
      vi.advanceTimersByTime(SHOWCASE_CYCLE_MS * 4);
    });
    expect(checked()).toBe("Stylist");
    expect(screen.getByRole("button", { name: "Play tour" })).toBeInTheDocument();
  });

  it("keeps the legend live region silent during autoplay and polite once user-driven", () => {
    renderShowcase();
    const legend = () => document.querySelector("p.flex-wrap")!;
    expect(legend().hasAttribute("aria-live")).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: "Stylist" }));
    expect(legend().getAttribute("aria-live")).toBe("polite");
  });

  it("swaps the play/pause label without aria-pressed", () => {
    renderShowcase();
    const btn = screen.getByRole("button", { name: "Pause tour" });
    expect(btn.hasAttribute("aria-pressed")).toBe(false);
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: "Play tour" })).toBeInTheDocument();
  });

  it("mirrors the legend arrow in Arabic", () => {
    render(
      <NextIntlClientProvider locale="ar" messages={enMessages}>
        <VocabularyShowcase />
      </NextIntlClientProvider>,
    );
    const legend = document.querySelector("p.flex-wrap")!;
    expect(legend.textContent).toContain("←");
    expect(legend.textContent).not.toContain("→");
  });
});
