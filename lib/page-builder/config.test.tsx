import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { puckConfig } from "./config";

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
