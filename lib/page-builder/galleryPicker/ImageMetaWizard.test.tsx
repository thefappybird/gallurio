import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImageMetaWizard, type ImageWizardLabels } from "./ImageMetaWizard";
import type { PickerItem } from "./types";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const labels: ImageWizardLabels = {
  heading: "Add photo details",
  position: (current, total) => `Photo ${current} of ${total}`,
  fieldTitle: "Title",
  fieldTitlePlaceholder: "Title placeholder",
  fieldCaption: "Description",
  fieldCaptionPlaceholder: "Description placeholder",
  fieldAlt: "Alt text",
  fieldAltHelp: "Alt help",
  fieldAltPlaceholder: "Alt placeholder",
  altCounter: (count, max) => `${count}/${max}`,
  fieldDate: "Date",
  fieldLocation: "Location",
  fieldLocationPlaceholder: "Location placeholder",
  fieldClient: "Client",
  fieldClientPlaceholder: "Client placeholder",
  fieldTags: "Tags",
  fieldTagsPlaceholder: "Add a tag",
  fieldTagsHint: "Up to 20 tags.",
  removeTag: (tag) => `Remove tag ${tag}`,
  fieldMeta: "Custom details",
  fieldMetaHint: "Meta hint",
  metaLabelPlaceholder: "Label",
  metaValuePlaceholder: "Value",
  addMetaRow: "Add detail",
  removeMetaRow: (n) => `Remove detail ${n}`,
  savedBadge: "Saved",
  unsavedBadge: "Unsaved",
  jumpToPhoto: (n) => `Go to photo ${n}`,
  previous: "Previous",
  next: "Next",
  finish: "Save and exit",
  close: "Close",
  errorMessage: (code) => (code === "not_found" ? "Not found." : "Something went wrong."),
};

const itemA: PickerItem = { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: null, altText: null };
const itemB: PickerItem = { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: null, altText: null };

beforeEach(() => {
  mockFetch.mockReset();
});

function open(items: PickerItem[] = [itemA, itemB], overrides: Partial<React.ComponentProps<typeof ImageMetaWizard>> = {}) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(
    <ImageMetaWizard items={items} open onOpenChange={onOpenChange} onSaved={onSaved} labels={labels} {...overrides} />
  );
  return { onOpenChange, onSaved };
}

describe("ImageMetaWizard", () => {
  it("shows the current photo's position", () => {
    open();
    expect(screen.getByText("Photo 1 of 2")).toBeTruthy();
  });

  it("prefills fields from the current item, blank when unset", () => {
    open();
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
  });

  it("Next PATCHes the current photo with the edited fields, then advances", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...itemA, title: "Golden hour" }) });
    const { onSaved } = open();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Golden hour" } });
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/portfolio/gallery/items/a");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toMatchObject({ title: "Golden hour" });

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Photo 2 of 2")).toBeTruthy());
  });

  it("Next does not PATCH when nothing changed on the current photo", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(await screen.findByText("Photo 2 of 2")).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("a failed save keeps the wizard on the same photo, shows the error, and keeps the typed value", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "not_found" }) });
    open();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Golden hour" } });
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Not found.");
    expect(screen.getByText("Photo 1 of 2")).toBeTruthy();
    expect(screen.getByLabelText("Title")).toHaveValue("Golden hour");
  });

  it("does not lose photo B's already-saved data when photo A's save later fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...itemA, title: "A title" }) });
    const { onSaved } = open();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "A title" } });
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "a", title: "A title" })));
    await screen.findByText("Photo 2 of 2");

    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "not_found" }) });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "B title" } });
    fireEvent.click(screen.getByRole("button", { name: /^save and exit$/i }));
    await screen.findByRole("alert");

    // Photo A's earlier successful save is untouched — onSaved for "a" was only ever called once.
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("closing with no unsaved edits closes immediately", () => {
    const { onOpenChange } = open();
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // The wizard is skippable, so a half-filled photo is a valid outcome and
  // there is nothing to discard: leaving saves, exactly like Next or the
  // finish button.
  it("closing with unsaved edits saves them, then closes", async () => {
    const { onOpenChange, onSaved } = open();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...itemA, title: "Unsaved" }) });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(String(init?.body)).title).toBe("Unsaved");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the wizard open with its error when the save on exit fails", async () => {
    const { onOpenChange } = open();
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "not_found" }) });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));

    await screen.findByRole("alert");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Title")).toHaveValue("Unsaved");
  });

  it("the finish button on the last photo saves it, then closes", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...itemB, title: "B title" }) });
    const { onOpenChange, onSaved } = open([itemB]);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "B title" } });
    fireEvent.click(screen.getByRole("button", { name: /^save and exit$/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("adds and removes a tag chip", () => {
    open();
    const tagInput = screen.getByPlaceholderText("Add a tag");
    fireEvent.change(tagInput, { target: { value: "outdoor" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    expect(screen.getByText("outdoor")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove tag outdoor" }));
    expect(screen.queryByText("outdoor")).toBeNull();
  });

  it("adds and removes a custom meta row", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /^add detail$/i }));
    expect(screen.getByPlaceholderText("Label")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove detail 1" }));
    expect(screen.queryByPlaceholderText("Label")).toBeNull();
  });

  it("jumping to another photo via the filmstrip saves the dirty current photo first", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...itemA, title: "A title" }) });
    open();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "A title" } });
    fireEvent.click(screen.getByRole("button", { name: "Go to photo 2" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(await screen.findByText("Photo 2 of 2")).toBeTruthy();
  });

  it("returns null when there are no items", () => {
    const { container } = render(
      <ImageMetaWizard items={[]} open onOpenChange={vi.fn()} onSaved={vi.fn()} labels={labels} />
    );
    expect(container.firstChild).toBeNull();
  });
});
