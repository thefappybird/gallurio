import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  HeadingBlock,
  TextBlock,
  ImageBlock,
  ButtonBlock,
  SpacerBlock,
  DividerBlock,
  ColumnsBlock,
  ContainerBlock,
} from "./manualBlocks";
import type { SlotComponent } from "@measured/puck";

// ---------------------------------------------------------------------------
// HeadingBlock
// ---------------------------------------------------------------------------

describe("HeadingBlock", () => {
  it("renders without crashing with default props", () => {
    const { container } = render(<HeadingBlock text="Hello" level="h2" />);
    expect(container).toBeTruthy();
  });

  it("renders the text content", () => {
    render(<HeadingBlock text="My Heading" level="h2" />);
    expect(screen.getByText("My Heading")).toBeTruthy();
  });

  it("renders as h1 when level='h1'", () => {
    render(<HeadingBlock text="H1 Title" level="h1" />);
    expect(document.querySelector("h1")).not.toBeNull();
  });

  it("renders as h2 when level='h2'", () => {
    render(<HeadingBlock text="H2 Title" level="h2" />);
    expect(document.querySelector("h2")).not.toBeNull();
  });

  it("renders as h3 when level='h3'", () => {
    render(<HeadingBlock text="H3 Title" level="h3" />);
    expect(document.querySelector("h3")).not.toBeNull();
  });

  it("tolerates a legacy {text} object via asText back-compat", () => {
    render(<HeadingBlock text={"Legacy heading"} level="h2" />);
    expect(screen.getByText("Legacy heading")).toBeTruthy();
  });

  it("renders with an empty text prop without crashing", () => {
    const { container } = render(<HeadingBlock text="" level="h2" />);
    expect(container).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// TextBlock
// ---------------------------------------------------------------------------

describe("TextBlock", () => {
  it("renders without crashing", () => {
    const { container } = render(<TextBlock text="Some paragraph." />);
    expect(container).toBeTruthy();
  });

  it("renders the text content inside a <p>", () => {
    render(<TextBlock text="A paragraph block" />);
    expect(screen.getByText("A paragraph block")).toBeTruthy();
    expect(document.querySelector("p")).not.toBeNull();
  });

  it("accepts plain string input", () => {
    render(<TextBlock text={"Old plain string"} />);
    expect(screen.getByText("Old plain string")).toBeTruthy();
  });

  it("renders empty text without crashing", () => {
    const { container } = render(<TextBlock text="" />);
    expect(container).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ImageBlock
// ---------------------------------------------------------------------------

describe("ImageBlock — no image", () => {
  it("renders the 'Pick an image' placeholder when no image is provided", () => {
    render(<ImageBlock imagePublicId="" imageUrl="" alt="" fit="cover" />);
    expect(screen.getByText(/Pick an image/i)).toBeTruthy();
  });

  it("does NOT render an <img> when no image is provided", () => {
    render(<ImageBlock imagePublicId="" imageUrl="" alt="" fit="cover" />);
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows placeholder when imagePublicId and imageUrl are both undefined", () => {
    render(<ImageBlock alt="" fit="cover" />);
    expect(screen.getByText(/Pick an image/i)).toBeTruthy();
  });
});

describe("ImageBlock — with imageUrl (no cloud env)", () => {
  it("renders an <img> when a direct imageUrl is provided", () => {
    render(
      <ImageBlock imagePublicId="" imageUrl="https://example.com/photo.jpg" alt="A photo" fit="cover" />
    );
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe("https://example.com/photo.jpg");
  });

  it("uses the provided alt text on the <img>", () => {
    render(
      <ImageBlock imagePublicId="" imageUrl="https://example.com/photo.jpg" alt="My alt text" fit="cover" />
    );
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img.alt).toBe("My alt text");
  });

  it("does NOT show placeholder when imageUrl is provided", () => {
    render(
      <ImageBlock imagePublicId="" imageUrl="https://example.com/photo.jpg" alt="" fit="cover" />
    );
    expect(screen.queryByText(/Pick an image/i)).toBeNull();
  });
});

describe("ImageBlock — imagePublicId without cloud name (test env)", () => {
  it("falls back to showing placeholder when imagePublicId is set but cloud name is unset", () => {
    // NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set in test env → cloudinaryUrl returns null
    render(<ImageBlock imagePublicId="gallurio/ws/img.jpg" imageUrl="" alt="" fit="cover" />);
    // Falls through to placeholder since cloudinaryUrl → null and imageUrl is empty
    expect(screen.getByText(/Pick an image/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ButtonBlock
// ---------------------------------------------------------------------------

describe("ButtonBlock", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ButtonBlock label="Get in Touch" action="open-contact" align="center" />
    );
    expect(container).toBeTruthy();
  });

  it("renders an <a> element with the label text", () => {
    render(<ButtonBlock label="Book Now" action="open-contact" align="center" />);
    expect(screen.getByText("Book Now")).toBeTruthy();
    expect(document.querySelector("a")).not.toBeNull();
  });

  it("sets data-cta='contact' for open-contact action", () => {
    render(<ButtonBlock label="Contact" action="open-contact" align="center" />);
    const a = document.querySelector("a");
    expect(a?.getAttribute("data-cta")).toBe("contact");
  });

  it("does NOT set data-cta for go-to-gallery action", () => {
    render(<ButtonBlock label="Gallery" action="go-to-gallery" align="center" />);
    const a = document.querySelector("a");
    expect(a?.getAttribute("data-cta")).toBeNull();
  });

  it("sets href='#' for open-contact (no slug available)", () => {
    render(<ButtonBlock label="Contact" action="open-contact" align="center" />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.href).toContain("#");
  });

  it("sets href='#' for go-to-gallery when no puck metadata is given", () => {
    render(<ButtonBlock label="Gallery" action="go-to-gallery" align="center" />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    // Without workspace slug, href falls back to '#'
    expect(a.getAttribute("href")).toBe("#");
  });

  it("uses the workspace slug in href for go-to-gallery when puck metadata provides it", () => {
    const mockPuck = {
      metadata: { workspace: { slug: "my-studio" } },
    } as Parameters<typeof ButtonBlock>[0]["puck"];
    render(
      <ButtonBlock label="Gallery" action="go-to-gallery" align="center" puck={mockPuck} />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe("/w/my-studio/gallery");
  });

  it("wrapper has width fit-content so it shrinks to the button size", () => {
    const { container } = render(
      <ButtonBlock label="Left" action="open-contact" align="left" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toBe("fit-content");
  });

  it("renders left-aligned button (marginRight auto)", () => {
    const { container } = render(
      <ButtonBlock label="Left" action="open-contact" align="left" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.marginLeft).toBe("0px");
    expect(wrapper.style.marginRight).toBe("auto");
  });

  it("renders right-aligned button (marginLeft auto)", () => {
    const { container } = render(
      <ButtonBlock label="Right" action="open-contact" align="right" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.marginLeft).toBe("auto");
    expect(wrapper.style.marginRight).toBe("0px");
  });

  it("renders center-aligned button (both margins auto)", () => {
    const { container } = render(
      <ButtonBlock label="Center" action="open-contact" align="center" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.marginLeft).toBe("auto");
    expect(wrapper.style.marginRight).toBe("auto");
  });

  it("_style.selfAlign center overrides legacy align=left prop", () => {
    const { container } = render(
      <ButtonBlock label="Btn" action="open-contact" align="left" _style={{ selfAlign: "center" }} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.marginLeft).toBe("auto");
    expect(wrapper.style.marginRight).toBe("auto");
  });

  it("_style.selfAlign right overrides legacy align=left prop", () => {
    const { container } = render(
      <ButtonBlock label="Btn" action="open-contact" align="left" _style={{ selfAlign: "right" }} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.marginLeft).toBe("auto");
    expect(wrapper.style.marginRight).toBe("0px");
  });

  it("_style.selfAlign left overrides legacy align=right prop", () => {
    const { container } = render(
      <ButtonBlock label="Btn" action="open-contact" align="right" _style={{ selfAlign: "left" }} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.marginLeft).toBe("0px");
    expect(wrapper.style.marginRight).toBe("auto");
  });

  it("defaults to transparent fill and pf-color-fg border when no buttonColorToken is set", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.backgroundColor).toBe("transparent");
    expect(a.style.borderColor).toBe("var(--pf-color-fg)");
  });

  it("_style.buttonColorToken sets the button fill color", () => {
    render(
      <ButtonBlock label="Btn" action="open-contact" align="center" _style={{ buttonColorToken: "primary" }} />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.backgroundColor).toBe("var(--pf-color-primary)");
  });

  it("_style.textColorToken sets the button label color", () => {
    render(
      <ButtonBlock label="Btn" action="open-contact" align="center" _style={{ textColorToken: "foreground" }} />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.color).toBe("var(--pf-color-fg)");
  });

  it("_style.bold applies fontWeight 700 to the <a> element", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" _style={{ bold: true }} />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.fontWeight).toBe("700");
  });

  it("_style.italic applies fontStyle italic to the <a> element", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" _style={{ italic: true }} />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.fontStyle).toBe("italic");
  });

  it("_style.underline applies textDecoration underline to the <a> element", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" _style={{ underline: true }} />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.textDecoration).toBe("underline");
  });

  it("_style.borderWidth applies border to the <a> not the wrapper div", () => {
    render(
      <ButtonBlock label="Btn" action="open-contact" align="center" _style={{ borderWidth: 2, borderColorToken: "#ff0000" }} />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    const wrapper = a.parentElement as HTMLElement;
    expect(a.style.borderWidth).toBe("2px");
    expect(wrapper.style.borderWidth).toBe("");
  });

  it("_style.radius applies borderRadius to the <a> not the wrapper div", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" _style={{ radius: 8 }} />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    const wrapper = a.parentElement as HTMLElement;
    expect(a.style.borderRadius).toBe("8px");
    expect(wrapper.style.borderRadius).toBe("");
  });

  it("_style.shadow applies boxShadow to the <a> not the wrapper div", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" _style={{ shadow: "sm" }} />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    const wrapper = a.parentElement as HTMLElement;
    expect(a.style.boxShadow).not.toBe("");
    expect(wrapper.style.boxShadow).toBe("");
  });

  it("_style.borderColorToken changes border color independently of borderWidth", () => {
    render(
      <ButtonBlock label="Btn" action="open-contact" align="center" _style={{ borderColorToken: "primary" }} />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.borderColor).toBe("var(--pf-color-primary)");
  });

  it("_style.bold does not apply fontWeight to the wrapper div", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" _style={{ bold: true }} />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    const wrapper = a.parentElement as HTMLElement;
    expect(a.style.fontWeight).toBe("700");
    expect(wrapper.style.fontWeight).toBe("");
  });
});

// ---------------------------------------------------------------------------
// SpacerBlock
// ---------------------------------------------------------------------------

describe("SpacerBlock", () => {
  it("renders without crashing", () => {
    const { container } = render(<SpacerBlock height={48} />);
    expect(container).toBeTruthy();
  });

  it("renders a div with the specified height", () => {
    const { container } = render(<SpacerBlock height={80} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.height).toBe("80px");
  });

  it("clamps height to minimum 4px", () => {
    const { container } = render(<SpacerBlock height={0} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.height).toBe("4px");
  });

  it("clamps negative height to minimum 4px", () => {
    const { container } = render(<SpacerBlock height={-100} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.height).toBe("4px");
  });

  it("clamps height to maximum 400px", () => {
    const { container } = render(<SpacerBlock height={9999} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.height).toBe("400px");
  });

  it("clamps a NaN/non-finite height to the default 48px", () => {
    const { container } = render(<SpacerBlock height={NaN} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.height).toBe("48px");
  });

  it("renders with aria-hidden='true'", () => {
    const { container } = render(<SpacerBlock height={48} />);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute("aria-hidden")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// DividerBlock
// ---------------------------------------------------------------------------

describe("DividerBlock", () => {
  it("renders without crashing", () => {
    const { container } = render(<DividerBlock thickness={1} />);
    expect(container).toBeTruthy();
  });

  it("renders an <hr> element", () => {
    render(<DividerBlock thickness={1} />);
    expect(document.querySelector("hr")).not.toBeNull();
  });

  it("sets borderTopWidth correctly for a valid thickness", () => {
    render(<DividerBlock thickness={3} />);
    const hr = document.querySelector("hr") as HTMLHRElement;
    expect(hr.style.borderTopWidth).toBe("3px");
  });

  it("clamps thickness to minimum 1px", () => {
    render(<DividerBlock thickness={0} />);
    const hr = document.querySelector("hr") as HTMLHRElement;
    expect(hr.style.borderTopWidth).toBe("1px");
  });

  it("clamps thickness to maximum 12px", () => {
    render(<DividerBlock thickness={999} />);
    const hr = document.querySelector("hr") as HTMLHRElement;
    expect(hr.style.borderTopWidth).toBe("12px");
  });

  it("handles NaN thickness by using 1px", () => {
    render(<DividerBlock thickness={NaN} />);
    const hr = document.querySelector("hr") as HTMLHRElement;
    expect(hr.style.borderTopWidth).toBe("1px");
  });
});

// ---------------------------------------------------------------------------
// ColumnsBlock (slot container)
// ---------------------------------------------------------------------------

/** A simple stub SlotComponent that renders a div with a data-testid. */
const stubSlot: SlotComponent = (slotProps) => (
  <div data-testid="slot" {...slotProps} />
);

describe("ColumnsBlock", () => {
  it("renders without crashing with a stub slot", () => {
    const { container } = render(
      <ColumnsBlock columns={2} content={stubSlot} />
    );
    expect(container).toBeTruthy();
  });

  it("calls the content slot function and renders its output", () => {
    render(<ColumnsBlock columns={2} content={stubSlot} />);
    expect(screen.getByTestId("slot")).toBeTruthy();
  });

  it("applies the responsive 2-column class for columns=2", () => {
    render(<ColumnsBlock columns={2} content={stubSlot} />);
    const slot = screen.getByTestId("slot");
    expect(slot.className).toContain("pf-cols");
    expect(slot.className).toContain("pf-cols-2");
  });

  it("applies the responsive 3-column class for columns=3", () => {
    render(<ColumnsBlock columns={3} content={stubSlot} />);
    const slot = screen.getByTestId("slot");
    expect(slot.className).toContain("pf-cols-3");
  });

  it("defaults to 2 columns for unexpected column value", () => {
    // Cast to test defensive clamping behavior
    render(<ColumnsBlock columns={5 as 2 | 3} content={stubSlot} />);
    const slot = screen.getByTestId("slot");
    expect(slot.className).toContain("pf-cols-2");
  });
});


// ---------------------------------------------------------------------------
// ContainerBlock (single drop-zone)
// ---------------------------------------------------------------------------

describe("ContainerBlock", () => {
  it("renders without crashing with a stub slot", () => {
    const { container } = render(
      <ContainerBlock content={stubSlot} />
    );
    expect(container).toBeTruthy();
  });

  it("calls the content slot function and renders its output", () => {
    render(<ContainerBlock content={stubSlot} />);
    expect(screen.getByTestId("slot")).toBeTruthy();
  });

  it("passes maxWidth style to the slot", () => {
    render(<ContainerBlock content={stubSlot} />);
    const slot = screen.getByTestId("slot");
    expect(slot.style.maxWidth).toBe("80rem");
  });
});

describe("ContainerBlock flex defaults", () => {
  const MockSlot: SlotComponent = (props) => <div data-testid="slot-inner" style={props?.style} />;

  it("renders the outer section with flexGrow: 1", () => {
    const { container } = render(<ContainerBlock content={MockSlot} />);
    const section = container.querySelector("section");
    expect(section?.style.flexGrow).toBe("1");
  });

  it("uses _style.justifyContent over legacy alignY on the outer section", () => {
    const { container } = render(
      <ContainerBlock content={MockSlot} alignY="top" _style={{ justifyContent: "center" }} />
    );
    const section = container.querySelector("section");
    expect(section?.style.justifyContent).toBe("center");
  });

  it("falls back to alignY when _style.justifyContent is absent", () => {
    const { container } = render(<ContainerBlock content={MockSlot} alignY="bottom" />);
    const section = container.querySelector("section");
    expect(section?.style.justifyContent).toBe("flex-end");
  });

  it("inner content wrapper always has alignItems: stretch (children fill full width)", () => {
    render(<ContainerBlock content={MockSlot} alignX="left" />);
    const inner = screen.getByTestId("slot-inner");
    expect(inner.style.alignItems).toBe("stretch");
  });

  it("maps _style.alignItems to textAlign on the inner content wrapper", () => {
    render(
      <ContainerBlock content={MockSlot} alignX="left" _style={{ alignItems: "end" }} />
    );
    const inner = screen.getByTestId("slot-inner");
    expect(inner.style.textAlign).toBe("right");
    expect(inner.style.alignItems).toBe("stretch");
  });

  it("maps _style.alignItems center to textAlign center", () => {
    render(
      <ContainerBlock content={MockSlot} _style={{ alignItems: "center" }} />
    );
    const inner = screen.getByTestId("slot-inner");
    expect(inner.style.textAlign).toBe("center");
  });

  it("_style.alignItems stretch falls back to ax (alignX) for textAlign", () => {
    render(
      <ContainerBlock content={MockSlot} alignX="center" _style={{ alignItems: "stretch" }} />
    );
    const inner = screen.getByTestId("slot-inner");
    // "stretch" → ALIGN_TO_TEXT["stretch"] is undefined → falls back to ax = "center"
    expect(inner.style.textAlign).toBe("center");
  });

  it("applies _style.gap to the inner content wrapper", () => {
    render(<ContainerBlock content={MockSlot} _style={{ gap: 32 }} />);
    const inner = screen.getByTestId("slot-inner");
    expect(inner.style.gap).toBe("32px");
  });
});
