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

describe("editor ContactDetails WYSIWYG", () => {
  it("renders typed email prop directly in the canvas (not as 'Email overridden')", () => {
    const Render = editorPuckConfig.components.ContactDetails.render;
    render(
      <Render
        id="cd-wysiwyg"
        _style={undefined}
        email="hi@example.com"
        puck={{} as never}
      />
    );
    expect(screen.getByText("hi@example.com")).toBeInTheDocument();
    expect(screen.queryByText(/overridden/i)).not.toBeInTheDocument();
  });

  it("shows placeholder when no contact props are set", () => {
    const Render = editorPuckConfig.components.ContactDetails.render;
    render(
      <Render
        id="cd-empty"
        _style={undefined}
        puck={{} as never}
      />
    );
    expect(screen.getByText("Workspace contact details")).toBeInTheDocument();
  });

  it("canvas normalizes a bare instagram handle to a full URL (no double-prefix)", () => {
    const Render = editorPuckConfig.components.ContactDetails.render;
    render(
      <Render
        id="cd-social"
        _style={undefined}
        instagram="myhandle"
        puck={{} as never}
      />
    );
    const link = screen.getByRole("link", { name: "Instagram" }) as HTMLAnchorElement;
    expect(link.href).toBe("https://instagram.com/myhandle");
  });

  it("canvas does not double-prefix a full https instagram URL", () => {
    const Render = editorPuckConfig.components.ContactDetails.render;
    render(
      <Render
        id="cd-social-full"
        _style={undefined}
        instagram="https://instagram.com/myhandle"
        puck={{} as never}
      />
    );
    const link = screen.getByRole("link", { name: "Instagram" }) as HTMLAnchorElement;
    expect(link.href).toBe("https://instagram.com/myhandle");
    expect(link.href).not.toContain("instagram.com/https://");
  });

  it("canvas socials dd defaults to justifyContent center when valueAlign is unset", () => {
    const Render = editorPuckConfig.components.ContactDetails.render;
    const { container } = render(
      <Render
        id="cd-justify"
        _style={undefined}
        instagram="testhandle"
        puck={{} as never}
      />
    );
    const dd = container.querySelector("dd") as HTMLElement;
    expect(dd.style.justifyContent).toBe("center");
  });

  it("canvas socials dd honors contactIconAlign over valueAlign", () => {
    const Render = editorPuckConfig.components.ContactDetails.render;
    const { container } = render(
      <Render
        id="cd-icon-align"
        _style={{ valueAlign: "left", contactIconAlign: "right" }}
        instagram="testhandle"
        puck={{} as never}
      />
    );
    const dd = container.querySelector("dd") as HTMLElement;
    expect(dd.style.justifyContent).toBe("flex-end");
  });

  it("canvas dl emits the same data-anim/data-hover attrs production does", () => {
    const Render = editorPuckConfig.components.ContactDetails.render;
    const { container } = render(
      <Render
        id="cd-attrs"
        _style={{ animation: "slide-up", hover: "lift" }}
        email="hi@example.com"
        puck={{} as never}
      />
    );
    const dl = container.querySelector("dl") as HTMLElement;
    expect(dl.getAttribute("data-anim")).toBe("slide-up");
    expect(dl.getAttribute("data-hover")).toBe("lift");
  });

  it("canvas Follow-row wrapper uses the same gap production's SocialsRow does", () => {
    const Render = editorPuckConfig.components.ContactDetails.render;
    const { container } = render(
      <Render
        id="cd-follow-gap"
        _style={undefined}
        instagram="testhandle"
        puck={{} as never}
      />
    );
    const wrapper = (container.querySelector("dd") as HTMLElement).parentElement as HTMLElement;
    expect(wrapper.style.gap).toBe("0.25rem");
  });
});
