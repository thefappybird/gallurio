import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./galleryPicker/usePickerData", () => ({
  usePickerData: () => ({
    state: {
      status: "ok",
      data: {
        collections: [{ id: "col-123", name: "Spring Weddings", coverUrl: null, itemCount: 12 }],
        items: [],
      },
    },
    retry: vi.fn(),
  }),
}));

import { editorPuckConfig } from "./editorConfig";

describe("editor gallery previews", () => {
  it("shows the selected collection name instead of the raw id when heading is empty", () => {
    const Preview = editorPuckConfig.components.GalleryGrid.render;
    render(
      <Preview
        id="preview-gallery-grid"
        _style={undefined}
        collectionId="col-123"
        columns={3}
        gap="normal"
        maxItems={12}
        puck={{} as never}
      />
    );

    expect(screen.getByText("Spring Weddings")).toBeInTheDocument();
    expect(screen.queryByText(/Collection: col-123/i)).toBeNull();
    expect(screen.queryByText("col-123")).toBeNull();
  });
});
