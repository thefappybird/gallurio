import { describe, it, expect } from "vitest";
import {
  appThemeAttributes,
  DEFAULT_APP_THEME,
  APP_RADII,
  type AppThemeConfig,
} from "./appTheme";

describe("appTheme seam", () => {
  it("maps every radius preset to its data-radius attribute and defaults to subtle", () => {
    // The default app theme must be the softened "subtle" corner preset — the
    // shipped look. This is the seam a future user-theming UI flips.
    expect(DEFAULT_APP_THEME.radius).toBe("subtle");
    expect(appThemeAttributes(DEFAULT_APP_THEME)).toEqual({ "data-radius": "subtle" });

    // Each supported preset round-trips to the matching <html data-radius> value
    // that globals.css keys its --radius / --radius-surface overrides on.
    for (const radius of APP_RADII) {
      const config: AppThemeConfig = { radius };
      expect(appThemeAttributes(config)).toEqual({ "data-radius": radius });
    }

    expect([...APP_RADII]).toEqual(["sharp", "subtle", "rounded"]);
  });
});
