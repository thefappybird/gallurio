import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { PresetMediaPlaceholder } from "./PresetMediaPlaceholder";

describe("PresetMediaPlaceholder", () => {
  it.each(["grid", "masonry", "collections"] as const)(
    "%s uses portfolio tokens instead of inherited currentColor",
    (kind) => {
      const html = renderToStaticMarkup(
        <PresetMediaPlaceholder kind={kind} columns={3} gap="normal" />
      );

      expect(html).not.toContain("currentColor");
      expect(html).toContain("var(--pf-color-fg)");
      expect(html).toContain("var(--pf-color-bg)");
      expect(html).toContain("var(--pf-color-accent)");
    }
  );

  it.each(["image", "video", "background"] as const)(
    "renders a tailored %s sample",
    (kind) => {
      const { container } = render(<PresetMediaPlaceholder kind={kind} />);
      expect(
        container.querySelector(`[data-preset-media-placeholder='${kind}']`)
      ).toBeInTheDocument();
      if (kind !== "video") {
        expect(container.querySelector("[data-preset-photo-tile='true']")).toBeInTheDocument();
      }
    }
  );
});
