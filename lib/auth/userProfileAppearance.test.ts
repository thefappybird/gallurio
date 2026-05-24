import { describe, it, expect } from "vitest";
import { buildUserProfileAppearance } from "@/lib/auth/userProfileAppearance";

describe("buildUserProfileAppearance", () => {
  describe("scheme=dark", () => {
    const appearance = buildUserProfileAppearance({ scheme: "dark" });

    it("returns a defined baseTheme", () => {
      expect(appearance.baseTheme).toBeDefined();
    });

    it("uses CSS variable for colorBackground", () => {
      expect(appearance.variables?.colorBackground).toBe("var(--background)");
    });

    it("uses 0px for borderRadius (sharp edges)", () => {
      expect(appearance.variables?.borderRadius).toBe("0px");
    });

    it("maps colorPrimary to var(--primary)", () => {
      expect(appearance.variables?.colorPrimary).toBe("var(--primary)");
    });

    it("maps colorDanger to var(--destructive)", () => {
      expect(appearance.variables?.colorDanger).toBe("var(--destructive)");
    });

    it("formButtonPrimary element contains rounded-none and bg-primary", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cls = (appearance.elements as any)?.formButtonPrimary as string;
      expect(cls).toContain("rounded-none");
      expect(cls).toContain("bg-primary");
    });
  });

  describe("scheme=light", () => {
    const appearance = buildUserProfileAppearance({ scheme: "light" });

    it("returns undefined baseTheme", () => {
      expect(appearance.baseTheme).toBeUndefined();
    });

    it("uses CSS variable for colorBackground", () => {
      expect(appearance.variables?.colorBackground).toBe("var(--background)");
    });

    it("uses 0px for borderRadius (sharp edges)", () => {
      expect(appearance.variables?.borderRadius).toBe("0px");
    });

    it("maps colorPrimary to var(--primary)", () => {
      expect(appearance.variables?.colorPrimary).toBe("var(--primary)");
    });

    it("maps colorDanger to var(--destructive)", () => {
      expect(appearance.variables?.colorDanger).toBe("var(--destructive)");
    });

    it("formButtonPrimary element contains rounded-none and bg-primary", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cls = (appearance.elements as any)?.formButtonPrimary as string;
      expect(cls).toContain("rounded-none");
      expect(cls).toContain("bg-primary");
    });
  });
});
