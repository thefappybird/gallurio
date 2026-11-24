import { describe, expect, it } from "vitest";
import { categoryLine } from "./labels";

const t = (key: string) => (key === "businessType.photographer" ? "Photographer" : key);

describe("categoryLine", () => {
  it("joins the category label and the localized country with a middle dot", () => {
    expect(categoryLine({ category: "photographer", country: "PH" }, "en", t)).toBe("Photographer · Philippines");
  });
});
