import { describe, expect, it, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import SettingsError from "./error";

const refresh = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

describe("SettingsError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    refresh.mockClear();
  });

  it("calls reset when the retry button is clicked", () => {
    const reset = vi.fn();
    renderWithProviders(<SettingsError error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("refreshes the route and calls reset when the reload button is clicked", () => {
    const reset = vi.fn();
    renderWithProviders(<SettingsError error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Reload page" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error with the settings-error-boundary prefix", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");
    renderWithProviders(<SettingsError error={error} reset={vi.fn()} />);
    expect(spy).toHaveBeenCalledWith("[settings-error-boundary]", error);
  });
});
