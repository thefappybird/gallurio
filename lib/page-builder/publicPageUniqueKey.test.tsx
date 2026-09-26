/**
 * Regression test for the Puck RSC "unique key" warning (Run 1 probe,
 * e2e/.artifacts/perf-probes/unique-key-console.json): Puck's RSC slot
 * renderer keys nested slot children by `item.props.id`
 * (`@puckeditor/core/dist/chunk-YQWFSBOU.mjs`), and template-authored nested
 * slot children carry no id by design (`templates/_blocks.ts`). Renders a
 * real starter template's home zone through the full public-page pipeline
 * (`normalizePublicPageData`, which now calls `ensureBlockIds`) and the real
 * RSC `<Render>` to prove no id-less child reaches the DOM.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { Render } from "@puckeditor/core/rsc";
import type { Config, Data } from "@puckeditor/core";
import { puckConfig } from "./config";
import { getTemplate } from "./templates";
import { normalizePublicPageData } from "./normalizePublicPageData";

vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn((publicId: string) => `https://res.cloudinary.com/test/image/upload/${publicId}`),
}));

const KNOWN_TYPES = new Set(Object.keys(puckConfig.components));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("public page render — no React unique-key warning", () => {
  it("renders the editorial template's home zone with no 'unique \"key\"' console.error", () => {
    const template = getTemplate("editorial");
    if (!template) throw new Error("editorial template not found");
    const seed = template.seedData({ workspace: { name: "Test Studio" } });
    const normalized = normalizePublicPageData(seed.home, KNOWN_TYPES, "home");
    expect(normalized).not.toBeNull();

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(
      <Render config={puckConfig as unknown as Config} data={normalized as unknown as Data} />,
    );
    unmount();

    const keyWarnings = errorSpy.mock.calls.filter((args) =>
      args.some((arg) => typeof arg === "string" && arg.includes('unique "key"')),
    );
    expect(keyWarnings).toEqual([]);
  });
});
