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
  it("fills its grid row and gives the slot the default horizontal page margin", () => {
    const Content = vi.fn(() => <div data-testid="body-slot" />) as unknown as SlotComponent;
    const { container } = render(
      <PageBodyBlock content={Content} puck={{ isEditing: false } as never} />,
    );
    const section = container.querySelector('[data-block="page-body"]') as HTMLElement;

    expect(section.style.width).toBe("100%");
    expect(section.style.height).toBe("100%");
    expect(Content).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          paddingLeft: PAGE_BODY_MARGIN_X_DEFAULT,
          paddingRight: PAGE_BODY_MARGIN_X_DEFAULT,
        }),
      }),
    );
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
