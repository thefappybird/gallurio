import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImageMetaDialog, IMAGE_META_ALT_MAX, type ImageMetaLabels } from "./ImageMetaDialog";
import type { PickerItem } from "./types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from "sonner";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const labels: ImageMetaLabels = {
  title: "Edit alt text",
  altLabel: "Alt text",
  altHelp: "Describe what the photo shows.",
  altPlaceholder: "e.g. Bride and groom dancing",
  counter: (count, max) => `${count}/${max}`,
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
  savedToast: "Alt text saved.",
  errorMessage: (code) => {
    if (code === "not_found") return "Not found.";
    if (code === "owner_only") return "Only the workspace owner can do this.";
    if (code === "invalid_input") return "Please check the form and try again.";
    return "Something went wrong. Please try again.";
  },
};

const item: PickerItem = {
  id: "item-1",
  publicId: "pid-1",
  thumbUrl: "https://x/a.jpg",
  caption: "A wedding photo",
  altText: "Bride and groom",
};

beforeEach(() => {
  mockFetch.mockReset();
  vi.mocked(toast.success).mockClear();
});

function open(overrides: Partial<React.ComponentProps<typeof ImageMetaDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(
    <ImageMetaDialog
      item={item}
      open
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      labels={labels}
      {...overrides}
    />
  );
  return { onOpenChange, onSaved };
}

describe("ImageMetaDialog", () => {
  it("prefills the field from item.altText", () => {
    open();
    expect(screen.getByLabelText("Alt text")).toHaveValue("Bride and groom");
  });

  it("prefills empty when altText is null", () => {
    open({ item: { ...item, altText: null } });
    expect(screen.getByLabelText("Alt text")).toHaveValue("");
  });

  it("updates the character counter as the user types", () => {
    open();
    fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: "New alt text" } });
    expect(screen.getByText("12/300")).toBeTruthy();
  });

  it("does not mark the counter as a live region while typing well under the limit", () => {
    open();
    fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: "New alt text" } });
    expect(screen.getByText("12/300").getAttribute("aria-live")).toBeNull();
  });

  it("marks the counter as a polite live region once within 20 characters of the limit", () => {
    open();
    const nearLimit = "x".repeat(IMAGE_META_ALT_MAX - 20); // exactly 20 remaining
    fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: nearLimit } });
    expect(screen.getByText(`${nearLimit.length}/300`).getAttribute("aria-live")).toBe("polite");
  });

  it("PATCHes the item id with only { altText } on save", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...item, altText: "New alt text" }),
    });
    const { onSaved } = open();
    fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: "New alt text" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/portfolio/gallery/items/item-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ altText: "New alt text" });

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...item, altText: "New alt text" }));
  });

  it("disables Save and shows saving copy while the request is in flight", async () => {
    let resolveFetch: (r: unknown) => void = () => {};
    mockFetch.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));
    open();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled());
    resolveFetch({ ok: true, json: async () => item });
  });

  it("calls onSaved and closes on success", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => item });
    const { onSaved, onOpenChange } = open();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(item));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith("Alt text saved.");
  });

  it.each([
    ["not_found", "Not found."],
    ["owner_only", "Only the workspace owner can do this."],
    ["invalid_input", "Please check the form and try again."],
    ["something_else", "Something went wrong. Please try again."],
  ])("renders the mapped message for error code %s", async (code, message) => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: code }) });
    open();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
  });

  it("does not PATCH when Cancel is clicked", () => {
    const { onOpenChange } = open();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
