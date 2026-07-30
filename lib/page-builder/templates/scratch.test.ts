import { describe, it, expect } from "vitest";
import { scratchTemplate } from "./scratch";
import { getTemplate, PORTFOLIO_TEMPLATES } from "./index";

describe("scratchTemplate", () => {
  it("seeds empty home and gallery zones", () => {
    const data = scratchTemplate.seedData({ workspace: { name: "X" } });
    const emptyThemedZone = {
      content: [],
      root: {
        props: {
          _rootStyle: {
            bgColorToken: "background",
          },
        },
      },
    };
    expect(data.home).toEqual(emptyThemedZone);
    expect(data.gallery).toEqual(emptyThemedZone);
  });

  it("is registered and resolvable by id, in the reserved last slot", () => {
    expect(getTemplate("scratch")).toBe(scratchTemplate);
    expect(PORTFOLIO_TEMPLATES[PORTFOLIO_TEMPLATES.length - 1].id).toBe("scratch");
  });
});
