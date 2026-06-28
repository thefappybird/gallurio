"use client";
/**
 * Tests for PublishDialog slug editing (Fix #5).
 *
 * `onUpdateSlug` is injected as a prop — no server-action import needed.
 * `checkSlugAvailabilityAction` (inside useSlugAvailability) is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

// ---- External mocks ---------------------------------------------------------

const mockCheckSlugAvailability = vi.fn();
vi.mock("@/lib/actions/slug", () => ({
  checkSlugAvailabilityAction: (...args: unknown[]) =>
    mockCheckSlugAvailability(...args),
}));

// ---- Lazy import (after mocks) ----------------------------------------------

import { PublishDialog } from "./PublishDialog";

// ---- Helpers ----------------------------------------------------------------

const mockUpdateSlug = vi.fn();

function renderDialog(
  props: Partial<React.ComponentProps<typeof PublishDialog>> = {},
) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    publicUrl: "https://gallurio.com/w/test-studio",
    currentSlug: "test-studio",
    onSlugSaved: vi.fn(),
    onUpdateSlug: mockUpdateSlug,
  };
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PublishDialog {...defaults} {...props} />
    </NextIntlClientProvider>,
  );
}

// ---- Tests ------------------------------------------------------------------

describe("PublishDialog slug editing (Fix #5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckSlugAvailability.mockResolvedValue({ available: true });
    mockUpdateSlug.mockResolvedValue({ ok: true });
  });

  it("renders a slug input pre-filled with currentSlug", async () => {
    renderDialog();
    const input = screen.getByRole("textbox", { name: /portfolio url/i });
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("test-studio");
  });

  it("Save URL button is disabled when slug is unchanged", async () => {
    renderDialog();
    const saveBtn = screen.getByRole("button", { name: /save url/i });
    expect(saveBtn).toBeDisabled();
  });

  it("Save URL button enables when slug changes and availability is confirmed", async () => {
    renderDialog();
    const input = screen.getByRole("textbox", { name: /portfolio url/i });

    fireEvent.change(input, { target: { value: "new-studio" } });

    await waitFor(
      () => {
        expect(mockCheckSlugAvailability).toHaveBeenCalledWith("new-studio");
      },
      { timeout: 1000 },
    );

    await waitFor(() => {
      const saveBtn = screen.getByRole("button", { name: /save url/i });
      expect(saveBtn).not.toBeDisabled();
    });
  });

  it("calls onUpdateSlug and onSlugSaved on successful save", async () => {
    const onSlugSaved = vi.fn();
    renderDialog({ onSlugSaved });

    const input = screen.getByRole("textbox", { name: /portfolio url/i });
    fireEvent.change(input, { target: { value: "new-studio" } });

    await waitFor(() => {
      const saveBtn = screen.getByRole("button", { name: /save url/i });
      expect(saveBtn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /save url/i }));

    await waitFor(() => {
      expect(mockUpdateSlug).toHaveBeenCalledWith("new-studio");
      expect(onSlugSaved).toHaveBeenCalledWith("new-studio");
    });
  });

  it("shows url_taken error when onUpdateSlug rejects slug", async () => {
    mockUpdateSlug.mockResolvedValue({ error: "url_taken" });

    renderDialog();
    const input = screen.getByRole("textbox", { name: /portfolio url/i });
    fireEvent.change(input, { target: { value: "taken-slug" } });

    await waitFor(() => {
      const saveBtn = screen.getByRole("button", { name: /save url/i });
      expect(saveBtn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /save url/i }));

    await waitFor(() => {
      expect(screen.getByText(/already taken/i)).toBeInTheDocument();
    });
  });
});
