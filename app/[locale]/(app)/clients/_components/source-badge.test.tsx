import { describe, it, expect } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { SourceBadge } from "./source-badge";

const SOURCES = ["form", "manual", "referral", "import"] as const;

const LABELS: Record<(typeof SOURCES)[number], string> = {
  form: "Form",
  manual: "Manual",
  referral: "Referral",
  import: "Import",
};

describe("SourceBadge", () => {
  it("renders the translated label for each source", () => {
    for (const source of SOURCES) {
      const { getByText, unmount } = renderWithProviders(<SourceBadge source={source} />);
      expect(getByText(LABELS[source])).toBeDefined();
      unmount();
    }
  });

  it("applies a distinct color class to each of the four sources", () => {
    const classNames = SOURCES.map((source) => {
      const { container, unmount } = renderWithProviders(<SourceBadge source={source} />);
      const cls = container.firstElementChild?.getAttribute("class") ?? "";
      unmount();
      return cls;
    });
    // Every source must yield a unique class string — no two pills share a color.
    // Note: class uniqueness ≠ perceptual distinctness; the actual contrast/hue
    // separation between the four pills is verified visually, not here.
    expect(new Set(classNames).size).toBe(SOURCES.length);
  });

  it("merges an extra className without dropping the source color", () => {
    const { container } = renderWithProviders(<SourceBadge source="form" className="ml-2" />);
    const cls = container.firstElementChild?.getAttribute("class") ?? "";
    expect(cls).toContain("ml-2");
    expect(cls).toContain("text-brand");
  });
});
