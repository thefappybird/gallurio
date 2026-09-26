/**
 * item 2b (docs/portfolio/puck-023-followups.md): proves the split keeps SSR
 * intact. `lazy.ts` wraps each island in `next/dynamic` with the default
 * `ssr: true` — a Server Component (the public page's real `@puckeditor/core/rsc`
 * `Render`) must still emit real markup (gallery tile `<img>`s, collection
 * covers) for crawlers, not just a client-side-only placeholder. Uses the REAL
 * (unmocked) `next/dynamic` — sibling test files mock it away for
 * synchronous-render convenience, which would prove nothing about SSR here.
 *
 * Real `next/dynamic` is `React.lazy` + Suspense, so the first commit paints
 * the `loading` fallback (`null`) before the loader's `import()` settles —
 * `findBy*` awaits that settle instead of reading `container.innerHTML`
 * synchronously (this is the "await the resolved component" fallback the
 * item 2b brief calls for).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Render } from "@puckeditor/core/rsc";
import type { Config, Data } from "@puckeditor/core";
import { puckConfig } from "@/lib/page-builder/config";
import { FeaturedWorkBlock, featuredWorkDefaultProps } from "./FeaturedWorkBlock";
import { galleryGridDefaultProps } from "./GalleryGridBlock";

beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});

describe("item 2b — SSR stays intact through the lazy islands", () => {
  // Called directly (same isomorphic function the RSC `Render` invokes for
  // this component type) rather than through Puck's `Render` pipeline, which
  // strips `collections` since it isn't a registered sidebar `field` — a
  // Puck data-shape quirk unrelated to item 2b's SSR claim.
  it("FeaturedWork's cover renders as a real <img> with real next/dynamic", async () => {
    render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[
          { id: "c1", name: "Weddings", coverPublicId: "gallurio/cover.jpg", itemCount: 5 },
        ]}
      />
    );

    // FeaturedCollectionsClient's chunk pulls in the whole CollectionPopup
    // subtree (popup layouts, ImmersiveViewer, Lightbox) — genuinely slower to
    // resolve cold than GalleryLightboxTrigger's below, past the default
    // findBy timeout. The tile's accessible name lives on the wrapping
    // <button> — its cover <img> is deliberately aria-hidden (the name would
    // otherwise be announced twice), so query the img via the DOM, not a role.
    const tile = await screen.findByRole("button", { name: "Weddings — 5 photos" }, { timeout: 5000 });
    const cover = tile.querySelector("img");
    expect(cover).not.toBeNull();
    expect(cover?.getAttribute("src")).toBeTruthy();
  });

  it("a gallery tile renders as a real <img> through the real RSC Render + next/dynamic", async () => {
    const data = {
      root: {},
      content: [
        {
          type: "GalleryGrid",
          props: {
            ...galleryGridDefaultProps,
            id: "gg-ssr",
            images: [{ id: "img-1", publicId: "gallurio/photo.jpg", alt: "A photo" }],
          },
        },
      ],
    } as unknown as Data;

    const { container } = render(<Render config={puckConfig as unknown as Config} data={data} />);

    const trigger = await screen.findByRole("button", { name: "A photo" });
    const img = within(trigger).getByRole("img");
    expect(img.getAttribute("src")).toBeTruthy();
    expect(container.querySelector("img")).not.toBeNull();
  });
});
