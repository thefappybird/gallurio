import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// GalleryCollectionPreview and usePickerData were removed when gallery blocks
// became isomorphic. The editor now renders the real GalleryGridBlock, which
// shows an empty-state message when images: []. No picker data is needed.
vi.mock("./galleryPicker/usePickerData", () => ({
  usePickerData: () => ({
    state: { status: "ok", data: { collections: [], items: [] } },
    retry: vi.fn(),
  }),
}));

import { editorPuckConfig } from "./editorConfig";

describe("editor gallery previews", () => {
  it("renders the real GalleryGridBlock empty state when images is empty", () => {
    const Preview = editorPuckConfig.components.GalleryGrid.render;
    render(
      <Preview
        id="preview-gallery-grid"
        _style={undefined}
        images={[]}
        puck={{} as never}
      />
    );

    expect(screen.getByText("No photos in this collection yet.")).toBeInTheDocument();
  });
});
