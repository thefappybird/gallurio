import { describe, it, expect } from "vitest";
import { containerAnchorDefaultProps, containerAnchorBlockConfig } from "./manualBlocks";

describe("ContainerAnchor block", () => {
  it("has no default props (the anchor carries no persisted geometry)", () => {
    expect(containerAnchorDefaultProps).toEqual({});
  });

  it("registers the correct label", () => {
    expect(containerAnchorBlockConfig.label).toBe("ContainerAnchor");
  });

  it("disables drag, delete, duplicate, insert, and edit permissions", () => {
    const p = containerAnchorBlockConfig.permissions ?? {};
    expect(p.drag).toBe(false);
    expect(p.delete).toBe(false);
    expect(p.duplicate).toBe(false);
    expect(p.insert).toBe(false);
    expect(p.edit).toBe(false);
  });
});
