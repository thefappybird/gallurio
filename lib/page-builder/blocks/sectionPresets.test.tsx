import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Render } from "@measured/puck";
import { puckConfig } from "../config";
import { HERO_PRESET, SERVICES_PRESET } from "./sectionPresets";

// Gallery blocks (imported transitively via config) touch the Cloudinary SDK.
vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn((id: string) => `https://res.cloudinary.com/test/${id}`),
}));

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
