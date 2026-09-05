import { describe, it, expect } from "vitest";
import { scratchTemplate } from "./scratch";
import { getTemplate, PORTFOLIO_TEMPLATES } from "./index";

describe("scratchTemplate", () => {
  it("seeds home and gallery zones with only a pinned Navigation block — no longer header-less", () => {
    const data = scratchTemplate.seedData({ workspace: { name: "X" } });
    for (const zoneData of [data.home, data.gallery]) {
      expect(zoneData?.content).toHaveLength(1);
      expect(zoneData?.content[0].type).toBe("Navigation");
      expect((zoneData?.content[0].props as { _chrome?: string })._chrome).toBe("nav");
      expect(zoneData?.root).toEqual({
        props: {
          _rootStyle: {
            bgColorToken: "background",
          },
        },
      });
    }
  });

  it("is registered and resolvable by id, in the reserved last slot", () => {
    expect(getTemplate("scratch")).toBe(scratchTemplate);
    expect(PORTFOLIO_TEMPLATES[PORTFOLIO_TEMPLATES.length - 1].id).toBe("scratch");
  });
});
