import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import type { Permissions } from "@measured/puck";
import { puckConfig } from "./config";
import { PRESET_GROUP_IDS } from "./blocks/sectionPresets";
import {
  FOOTER_SIGNATURE_PRESET,
  FOOTER_DIRECTORY_PRESET,
  FOOTER_STATEMENT_PRESET,
} from "./blocks/presets/footer";
import { containerDefaultProps } from "./blocks/manualBlocks";

describe("production root render applies root style", () => {
  it("wraps children with the resolved root style", () => {
    const RootRender = puckConfig.root!.render!;
    const { container } = render(
      React.createElement(
        RootRender as React.FC<{ _rootStyle?: unknown; children?: React.ReactNode }>,
        { _rootStyle: { bgColorToken: "primary", paddingX: "20px" } },
        React.createElement("div", { "data-testid": "child" }),
      ),
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.backgroundColor).toContain("var(--pf-color-primary)");
    expect(wrapper.style.paddingLeft).toBe("20px");
    expect(wrapper.querySelector("[data-testid='child']")).not.toBeNull();
  });

  it("makes the root the pfpage query container and injects the responsive sheet", () => {
    const RootRender = puckConfig.root!.render!;
    const { container } = render(
      React.createElement(
        RootRender as React.FC<{ _rootStyle?: unknown; children?: React.ReactNode }>,
        {},
        React.createElement("div", { "data-testid": "child" }),
      ),
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.containerType).toBe("inline-size");
    expect(wrapper.style.containerName).toBe("pfpage");
    const style = wrapper.querySelector("style");
    expect(style?.innerHTML).toContain("@container pfpage");
    expect(style?.innerHTML).toContain("--pf-pad");
  });
});

describe("puckConfig categories", () => {
  it("has the 11 registry group ids plus 'manual'", () => {
    const categoryIds = Object.keys(puckConfig.categories ?? {});
    expect(categoryIds.sort()).toEqual([...PRESET_GROUP_IDS, "manual"].sort());
  });

  it("every key listed in every category is a registered component", () => {
    const componentKeys = new Set(Object.keys(puckConfig.components));
    for (const [categoryId, category] of Object.entries(puckConfig.categories ?? {})) {
      for (const key of category.components ?? []) {
        expect(componentKeys.has(key as string), `${categoryId} lists unregistered component ${String(key)}`).toBe(true);
      }
    }
  });
});

describe("production Container config — footer permission lock", () => {
  const basePermissions: Permissions = {
    drag: true,
    duplicate: true,
    delete: true,
    edit: true,
    insert: true,
  };
  type ResolvePermissionsFn = (
    data: { props: Record<string, unknown> },
    params: { permissions: Partial<Permissions> },
  ) => Partial<Permissions>;

  it.each([
    ["FooterSignaturePreset", FOOTER_SIGNATURE_PRESET],
    ["FooterDirectoryPreset", FOOTER_DIRECTORY_PRESET],
    ["FooterStatementPreset", FOOTER_STATEMENT_PRESET],
  ])("%s (production) locks duplicate + drag, keeps delete, for its own preset props", (key, presetProps) => {
    const cfg = puckConfig.components[key as keyof typeof puckConfig.components] as unknown as {
      resolvePermissions?: ResolvePermissionsFn;
    };
    expect(cfg.resolvePermissions, `${key} must declare resolvePermissions`).toBeDefined();
    const result = cfg.resolvePermissions!({ props: presetProps }, { permissions: basePermissions });
    expect(result.duplicate).toBe(false);
    expect(result.drag).toBe(false);
    expect(result.delete).toBe(true);
  });

  it("the base Container type carries the same resolvePermissions and leaves an ordinary Container alone", () => {
    const cfg = puckConfig.components.Container as unknown as { resolvePermissions?: ResolvePermissionsFn };
    expect(cfg.resolvePermissions, "Container must declare resolvePermissions").toBeDefined();
    const result = cfg.resolvePermissions!({ props: containerDefaultProps }, { permissions: basePermissions });
    expect(result).toBe(basePermissions);
  });
});
