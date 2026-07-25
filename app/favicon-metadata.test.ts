import { describe, expect, it } from "vitest";
import { metadata as localeMetadata } from "./[locale]/layout";
import { metadata as publicMetadata } from "./(public)/layout";

const faviconPath = "/brand/gallurio-sq-white.png";

describe("root favicon metadata", () => {
  it.each([
    ["localized app routes", localeMetadata],
    ["public portfolio routes", publicMetadata],
  ])("publishes the stable PNG favicon for %s", (_name, metadata) => {
    expect(metadata.icons).toEqual({
      icon: faviconPath,
      shortcut: faviconPath,
      apple: faviconPath,
    });
  });
});
