import { render, waitFor } from "@testing-library/react";
import { Puck, type Config, type Data } from "@measured/puck";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MasonryCloneBlock, masonryCloneBlockConfig } from "./MasonryCloneBlock";
import { imageBlockConfig } from "./manualBlocks";

const OLD_HASH = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
beforeEach(() => { process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash"; });
afterEach(() => { process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD_HASH; });

function tile(height: number) {
  return (
    <div
      ref={(element) => {
        if (element) element.getBoundingClientRect = () => ({ height } as DOMRect);
      }}
    />
  );
}

describe("MasonryCloneBlock", () => {
  it("renders as a real inert block and fills only its lane remainder", async () => {
    const { container } = render(
      <div>
        <div data-masonry-column>
          <div>{tile(100)}{tile(100)}{tile(100)}<div data-clone-host><MasonryCloneBlock masonryId="m1" column={1} gap={12} sourceId="source-1" imageProps={{ alt: "Source", _style: { bgImagePublicId: "asset/source-1" } }} layoutSignature="a" /></div></div>
        </div>
        <div data-masonry-column>
          <div>{tile(150)}{tile(150)}{tile(150)}<div data-clone-host><MasonryCloneBlock masonryId="m1" column={2} gap={12} sourceId="source-2" imageProps={{ alt: "Source", _style: { bgImagePublicId: "asset/source-2" } }} layoutSignature="a" /></div></div>
        </div>
      </div>,
    );

    const clones = container.querySelectorAll<HTMLElement>("[data-masonry-clone]");
    expect(clones).toHaveLength(2);
    expect(clones[0]).toHaveAttribute("inert");
    expect(clones[0]).toHaveAttribute("aria-hidden", "true");
    expect(clones[0]).toHaveAttribute("data-masonry-source-id", "source-1");
    expect(clones[0].querySelector("img")).toHaveAttribute("src", expect.stringContaining("asset/source-1"));
    const hosts = container.querySelectorAll<HTMLElement>("[data-clone-host]");
    await waitFor(() => {
      expect(hosts[0].style.height).toBe("138px");
      expect(hosts[0].style.display).toBe("block");
      expect(hosts[1].style.display).toBe("none");
    });
  });

  it("reads the linked source image from a real Puck editor canvas", async () => {
    const config = {
      components: {
        Image: imageBlockConfig,
        MasonryClone: masonryCloneBlockConfig,
      },
      root: { fields: {}, render: ({ children }: { children?: ReactNode }) => <>{children}</> },
    } as unknown as Config;
    const data = {
      root: {},
      content: [
        { type: "Image", props: { id: "live-source", alt: "Source", _style: { bgImagePublicId: "asset/live-source" } } },
        {
          type: "MasonryClone",
          props: {
            id: "clone",
            masonryId: "m1",
            column: 1,
            gap: 12,
            sourceId: "live-source",
            imageProps: { alt: "" },
            layoutSignature: "live",
          },
        },
      ],
    } as Data;

    const { container } = render(
      <Puck config={config} data={data} iframe={{ enabled: false }} onPublish={() => undefined} />,
    );

    await waitFor(() => {
      expect(container.querySelector("[data-masonry-clone] img"))
        .toHaveAttribute("src", expect.stringContaining("asset/live-source"));
    });
  });
});
