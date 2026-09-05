import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { Permissions, SlotComponent } from "@measured/puck";
import {
  PAGE_BODY_MARGIN_X_DEFAULT,
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
    expect(Content).toHaveBeenCalledWith(
      expect.objectContaining({
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

  it("is permanently locked while its contents remain insertable/editable", () => {
    const permissions = pageBodyPermissions as Permissions;
    expect(permissions).toMatchObject({ delete: false, duplicate: false, drag: false });
    expect(permissions.insert).not.toBe(false);
    expect(permissions.edit).not.toBe(false);
    expect(pageBodyDefaultProps.marginX).toBe(PAGE_BODY_MARGIN_X_DEFAULT);
  });
});
