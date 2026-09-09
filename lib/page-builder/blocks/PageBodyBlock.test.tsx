import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Render, type Permissions, type SlotComponent } from "@measured/puck";
import { puckConfig } from "../config";
import {
  PAGE_BODY_MARGIN_X_DEFAULT,
  PAGE_BODY_SLOT_CLASS,
  PageBodyBlock,
  pageBodyDefaultProps,
  pageBodyPermissions,
} from "./PageBodyBlock";

describe("PageBodyBlock", () => {
  it("takes the leftover page height and gives the slot the default horizontal page margin", () => {
    const Content = vi.fn(() => <div data-testid="body-slot" />) as unknown as SlotComponent;
    const { container } = render(
      <PageBodyBlock content={Content} puck={{ isEditing: false } as never} />,
    );
    const section = container.querySelector('[data-block="page-body"]') as HTMLElement;

    expect(section.style.width).toBe("100%");
    // Grows into what Navigation and Footer leave. A percentage height would
    // resolve against the element holding all three, so the body would claim the
    // whole page and push the footer down by the height of the chrome.
    expect(section.style.height).toBe("");
    expect(section.style.flex).toBe("1 1 auto");
    expect(section.style.getPropertyValue("--pf-page-body-margin-x")).toBe(PAGE_BODY_MARGIN_X_DEFAULT);
    expect(Content).toHaveBeenCalledWith(
      expect.objectContaining({
        className: PAGE_BODY_SLOT_CLASS,
        style: expect.objectContaining({
          paddingLeft: PAGE_BODY_MARGIN_X_DEFAULT,
          paddingRight: PAGE_BODY_MARGIN_X_DEFAULT,
        }),
      }),
    );
  });

  it("lays its slot children out in block flow so a child cannot stretch the row", () => {
    const Content = vi.fn(() => <div />) as unknown as SlotComponent;
    render(<PageBodyBlock content={Content} />);

    const [{ style }] = (Content as unknown as { mock: { calls: [{ style: Record<string, unknown> }][] } }).mock.calls[0];
    expect(style.display).toBe("block");
    expect(style.flexDirection).toBeUndefined();
    expect(style.flex).toBe("1 1 auto");
  });

  it("uses an explicitly selected horizontal margin", () => {
    const Content = vi.fn(() => <div />) as unknown as SlotComponent;
    render(<PageBodyBlock content={Content} marginX="4rem" />);

    expect(Content).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({ paddingLeft: "4rem", paddingRight: "4rem" }),
      }),
    );
  });

  it("scopes the page-margin offset to direct full-width Container children", () => {
    const Content = vi.fn(() => <div />) as unknown as SlotComponent;
    const { container } = render(<PageBodyBlock content={Content} marginX="4rem" />);
    const css = container.querySelector("style")?.textContent;

    expect(css).toContain(`.${PAGE_BODY_SLOT_CLASS} > [data-pf-full-width]`);
    expect(css).toContain("calc(100% + var(--pf-page-body-margin-x) + var(--pf-page-body-margin-x))");
    expect(css).toContain("calc(0px - var(--pf-page-body-margin-x))");
  });

  it("matches a direct full-width Container in a real Puck PageBody slot", () => {
    const { container } = render(
      <Render
        config={puckConfig}
        data={{
          root: {},
          content: [{
            type: "PageBody",
            props: {
              id: "page-body",
              marginX: "2rem",
              content: [{ type: "Container", props: { id: "full-hero", overallWidth: "full", content: [] } }],
            },
          }],
        }}
      />,
    );

    expect(container.querySelector(`.${PAGE_BODY_SLOT_CLASS} > [data-block="container"][data-pf-full-width]`)).not.toBeNull();
  });

  it("renders a PageBody carrying nested future-container defaults", () => {
    expect(() => render(
      <Render
        config={puckConfig}
        data={{
          root: {},
          content: [{
            type: "PageBody",
            props: {
              id: "page-body",
              containerDefaults: {
                radius: 8,
                paddingTop: "24px",
                paddingRight: "16px",
                paddingBottom: "24px",
                paddingLeft: "16px",
                marginTop: "0px",
                marginRight: "0px",
                marginBottom: "0px",
                marginLeft: "0px",
                gap: 16,
                overallWidth: "page-fit",
              },
              content: [],
            },
          }],
        }}
      />,
    )).not.toThrow();
  });

  it("is permanently locked while its contents remain insertable/editable", () => {
    const permissions = pageBodyPermissions as Permissions;
    expect(permissions).toMatchObject({ delete: false, duplicate: false, drag: false });
    expect(permissions.insert).not.toBe(false);
    expect(permissions.edit).not.toBe(false);
    expect(pageBodyDefaultProps.marginX).toBeUndefined();
  });

  it("defaults new direct children to 0px x-axis padding — the page margin is the only horizontal inset", () => {
    expect(pageBodyDefaultProps.containerDefaults).toMatchObject({
      paddingLeft: "0px",
      paddingRight: "0px",
    });
  });
});
