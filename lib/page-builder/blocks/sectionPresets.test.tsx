import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Render } from "@measured/puck";
import { puckConfig } from "../config";
import {
  FEATURED_WORK_PRESET,
  GALLERY_GRID_PRESET,
  GALLERY_LANDING_PRESET,
  GALLERY_MASONRY_PRESET,
  HERO_PRESET,
  SECTION_PRESETS,
  SERVICES_PRESET,
  VIDEO_PRESET,
} from "./sectionPresets";


describe("section presets render through Puck", () => {
  it("HeroPreset renders its composed children (heading, text, button)", () => {
    render(
      <Render
        config={puckConfig}
        data={{ root: {}, content: [{ type: "HeroPreset", props: { id: "hero-1", ...HERO_PRESET } }] }}
      />
    );
    expect(screen.getByText("Capturing moments that last forever")).toBeInTheDocument();
    expect(screen.getByText(/Fine art photography/)).toBeInTheDocument();
    expect(screen.getByText("Get in Touch")).toBeInTheDocument();
  });

  it("ServicesPreset renders nested Columns → Container cards", () => {
    render(
      <Render
        config={puckConfig}
        data={{ root: {}, content: [{ type: "ServicesPreset", props: { id: "svc-1", ...SERVICES_PRESET } }] }}
      />
    );
    expect(screen.getByText("Wedding Photography")).toBeInTheDocument();
    expect(screen.getByText("Portrait Sessions")).toBeInTheDocument();
    expect(screen.getByText(/From ₱30,000/)).toBeInTheDocument();
  });
});

describe("gallery section presets", () => {
  it.each([
    ["GalleryGridPreset", GALLERY_GRID_PRESET, "GalleryGrid"],
    ["GalleryMasonryPreset", GALLERY_MASONRY_PRESET, "GalleryMasonry"],
    ["FeaturedWorkPreset", FEATURED_WORK_PRESET, "FeaturedWork"],
  ] as const)("%s composes Container -> Heading -> Text -> %s", (_label, preset, leafType) => {
    const children = preset.content as Array<{ type: string }>;
    expect(children.map((child) => child.type)).toEqual(["Heading", "Text", leafType]);
  });
});

describe("section preset background shape", () => {
  it("every preset uses backgroundImages: [] (not the legacy backgroundImagePublicId)", () => {
    for (const [key, preset] of Object.entries(SECTION_PRESETS)) {
      const props = preset.defaultProps as Record<string, unknown>;
      expect(props, `${key} should expose backgroundImages`).toHaveProperty("backgroundImages");
      expect(Array.isArray(props.backgroundImages), `${key}.backgroundImages is an array`).toBe(true);
      expect(props, `${key} should drop backgroundImagePublicId`).not.toHaveProperty("backgroundImagePublicId");
    }
  });
});

describe("GalleryLandingPreset in puckConfig", () => {
  it("GalleryLandingPreset is registered in puckConfig and renders its heading", () => {
    render(
      <Render
        config={puckConfig}
        data={{ root: {}, content: [{ type: "GalleryLandingPreset", props: { id: "gl-1", ...GALLERY_LANDING_PRESET } }] }}
      />
    );
    expect(screen.getByText("Our gallery")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /get in touch/i })).not.toBeInTheDocument();
  });
});

describe("VideoPreset (F3 composite block)", () => {
  it("composes Container -> Heading -> Text -> Video, same shape as other presets", () => {
    const children = VIDEO_PRESET.content as Array<{ type: string }>;
    expect(children.map((child) => child.type)).toEqual(["Heading", "Text", "Video"]);
  });
});
