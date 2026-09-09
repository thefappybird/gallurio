import { describe, expect, it } from "vitest";
import {
  navigationLogoAssetId,
  navigationLogoPatch,
  navigationPropsWithZones,
  navigationZonesWithPatch,
} from "./navigationLogo";

const heading = { type: "Heading", props: { id: "nav-heading", level: "h3", text: "North Star Stories" } };

describe("navigation logo slot helpers", () => {
  it("reads established Puck slot children from data.zones", () => {
    const props = { id: "nav-1", content: [] };
    const zones = { "nav-1:content": [heading] };
    expect(navigationPropsWithZones(props, zones).content).toEqual([heading]);
  });

  it("inserts a square Image block capped to 75px high before the company heading", () => {
    const patch = navigationLogoPatch({ id: "nav-1", content: [heading] }, "asset/logo-1");
    expect(patch.content).toEqual([
      {
        type: "Image",
        props: {
          id: "nav-1--logo-image",
          alt: "Logo",
          _style: {
            width: "75px",
            height: "75px",
            imageFit: "contain",
            bgImagePublicId: "asset/logo-1",
          },
        },
      },
      heading,
    ]);
    expect(navigationLogoAssetId({ ...patch })).toBe("asset/logo-1");
  });

  it("updates an existing Image without disturbing its style or the heading", () => {
    const image = {
      type: "Image",
      props: { id: "logo", alt: "Studio mark", _style: { width: "3rem", radius: 8, bgImagePublicId: "old" } },
    };
    const patch = navigationLogoPatch({ id: "nav-1", content: [image, heading] }, "new");
    expect(patch.content[0]).toEqual({
      ...image,
      props: { ...image.props, _style: { width: "3rem", radius: 8, bgImagePublicId: "new" } },
    });
    expect(patch.content[1]).toEqual(heading);
  });

  it("removes the logo Image while preserving the company heading", () => {
    const image = { type: "Image", props: { id: "logo", alt: "Logo", _style: { bgImagePublicId: "old" } } };
    expect(navigationLogoPatch({ id: "nav-1", content: [image, heading] }, "").content).toEqual([heading]);
  });

  it("writes an inline content patch back to an established Puck zone", () => {
    const zones = { "nav-1:content": [heading], untouched: [] };
    const content = navigationLogoPatch({ id: "nav-1", content: [heading] }, "asset/logo-1").content;
    expect(navigationZonesWithPatch({ id: "nav-1" }, { content }, zones)).toEqual({
      ...zones,
      "nav-1:content": content,
    });
  });
});
