import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { GalleryLightboxTrigger } from "./GalleryLightboxTrigger";

const OLD = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD;
});

describe("GalleryLightboxTrigger", () => {
  it("opens the Lightbox with the given image when the trigger is clicked", async () => {
    render(
      <GalleryLightboxTrigger image={{ id: "img1", publicId: "workspace/photo1", alt: "Photo One" }}>
        <img src="thumb.jpg" alt="Photo One" />
      </GalleryLightboxTrigger>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Photo One" }));

    // Lightbox is a first-open-only chunk (loaded on demand) — it is not in
    // the same synchronous commit as the click.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Longer-than-default timeout: this chunk resolves cold when the shared
    // vitest worker is also transforming a sibling test file's dependencies.
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByAltText("Photo One")).toHaveAttribute("src", expect.stringContaining("photo1"));
  });
});
