"use client";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

const mockCheckSlugAvailability = vi.fn();
vi.mock("@/lib/actions/slug", () => ({
  checkSlugAvailabilityAction: (...args: unknown[]) =>
    mockCheckSlugAvailability(...args),
}));

const mockToDataURL = vi.fn();
vi.mock("qrcode", () => ({
  default: { toDataURL: (...args: unknown[]) => mockToDataURL(...args) },
}));

import { PublishDialog } from "./PublishDialog";

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
    hasBeenPublished: false,
    onSlugSaved: vi.fn(),
    onUpdateSlug: mockUpdateSlug,
  };
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PublishDialog {...defaults} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("PublishDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckSlugAvailability.mockResolvedValue({ available: true });
    mockUpdateSlug.mockResolvedValue({ ok: true });
    mockToDataURL.mockResolvedValue("data:image/png;base64,mockqr");
  });

  it("renders only the slug in the input and full URL below it", () => {
    renderDialog();
    const input = screen.getByRole("textbox", { name: /portfolio url/i });
    expect((input as HTMLInputElement).value).toBe("test-studio");
    expect(document.getElementById("publish-dialog-full-url")?.textContent).toContain("/w/test-studio");
  });

  it("checks the provisional URL immediately before a first publish", async () => {
    renderDialog({ hasBeenPublished: false });

    await waitFor(() => {
      expect(mockCheckSlugAvailability).toHaveBeenCalledWith("test-studio");
    });
    expect(screen.getByRole("button", { name: /publish now/i })).toBeEnabled();
  });

  it("hides a previously published URL behind an edit control", () => {
    renderDialog({ hasBeenPublished: true });
    expect(screen.queryByRole("textbox", { name: /portfolio url/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /edit portfolio url/i }));
    expect(screen.getByRole("textbox", { name: /portfolio url/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /publish now/i })).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: /^cancel$/i })[0]);
    expect(screen.queryByRole("textbox", { name: /portfolio url/i })).toBeNull();
    expect(screen.getByRole("button", { name: /publish now/i })).toBeEnabled();
  });

  it("updates the full URL live as the user types", () => {
    renderDialog();
    const input = screen.getByRole("textbox", { name: /portfolio url/i });
    fireEvent.change(input, { target: { value: "new-studio" } });
    expect(document.getElementById("publish-dialog-full-url")?.textContent).toContain("/w/new-studio");
  });

  it("keeps long public URLs horizontally scrollable instead of overflowing the modal", () => {
    renderDialog({
      currentSlug: "sarah-bell-photographytestingtest",
    });

    expect(document.getElementById("publish-dialog-full-url")).toHaveClass(
      "scrollbar-inline-subtle",
      "overflow-x-auto",
      "whitespace-nowrap",
    );
  });

  it("shows no save icon when slug is unchanged", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: /^save url$/i })).toBeNull();
  });

  it("enables save when slug changes and availability confirms", async () => {
    renderDialog();
    const input = screen.getByRole("textbox", { name: /portfolio url/i });
    fireEvent.change(input, { target: { value: "new-studio" } });

    await waitFor(() => {
      expect(mockCheckSlugAvailability).toHaveBeenCalledWith("new-studio");
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^save url$/i })).not.toBeDisabled();
    });
  });

  it("saves slug and reports it", async () => {
    const onSlugSaved = vi.fn();
    renderDialog({ onSlugSaved });

    const input = screen.getByRole("textbox", { name: /portfolio url/i });
    fireEvent.change(input, { target: { value: "new-studio" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^save url$/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /^save url$/i }));

    await waitFor(() => {
      expect(mockUpdateSlug).toHaveBeenCalledWith("new-studio");
      expect(onSlugSaved).toHaveBeenCalledWith("new-studio");
    });
  });

  it("shows taken error when save rejects slug", async () => {
    mockUpdateSlug.mockResolvedValue({ error: "url_taken" });
    renderDialog();

    const input = screen.getByRole("textbox", { name: /portfolio url/i });
    fireEvent.change(input, { target: { value: "taken-slug" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^save url$/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /^save url$/i }));

    await waitFor(() => {
      expect(screen.getByText(/already taken/i)).toBeInTheDocument();
    });
  });

  it("generates QR from the live URL", async () => {
    renderDialog();
    const input = screen.getByRole("textbox", { name: /portfolio url/i });
    fireEvent.change(input, { target: { value: "new-studio" } });

    await waitFor(() => {
      expect(mockToDataURL).toHaveBeenCalledWith(
        expect.stringContaining("/w/new-studio"),
        expect.any(Object),
      );
    });
  });

  it("renders QR inside drawer when expanded", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /^qr$/i }));
    const img = await screen.findByRole("img", { name: /qr code/i });
    expect((img as HTMLImageElement).src).toBe("data:image/png;base64,mockqr");
  });

  it("download QR triggers anchor click", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /^qr$/i }));
    await screen.findByRole("img", { name: /qr code/i });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: /download qr/i }));
    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });

  it("shows reset and save controls only after the slug changes", async () => {
    renderDialog();
    const input = screen.getByRole("textbox", { name: /portfolio url/i });

    expect(screen.queryByRole("button", { name: /^save url$/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^cancel$/i })).toHaveLength(1);

    fireEvent.change(input, { target: { value: "new-studio" } });

    await screen.findByRole("button", { name: /^save url$/i });
    expect(screen.getAllByRole("button", { name: /^cancel$/i })).toHaveLength(2);
  });
});
