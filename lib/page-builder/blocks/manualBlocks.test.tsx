import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
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
  columnsDefaultProps,
  containerDefaultProps,
  type HeadingBlockProps,
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

  it("renders as h4 when level='h4'", () => {
    render(<HeadingBlock text="H4 Title" level="h4" />);
    expect(document.querySelector("h4")).not.toBeNull();
  });

  it("renders as h5 when level='h5'", () => {
    render(<HeadingBlock text="H5 Title" level="h5" />);
    expect(document.querySelector("h5")).not.toBeNull();
  });

  it("renders as h6 when level='h6'", () => {
    render(<HeadingBlock text="H6 Title" level="h6" />);
    expect(document.querySelector("h6")).not.toBeNull();
  });

  it("heading level buttons use fluid clamp font sizes (renderToStaticMarkup checks CSS value)", () => {
    // JSDOM strips clamp() and cqi — use server markup to verify the literal CSS values.
    const expected: Array<[HeadingBlockProps["level"], string]> = [
      ["h1", "clamp(2rem, 1.4rem + 4cqi, 3rem)"],
      ["h2", "clamp(1.6rem, 1.2rem + 2.5cqi, 2.25rem)"],
      ["h3", "clamp(1.3rem, 1rem + 1.8cqi, 1.75rem)"],
      ["h4", "clamp(1.1rem, 0.95rem + 1cqi, 1.35rem)"],
      ["h5", "clamp(1rem, 0.9rem + 0.6cqi, 1.125rem)"],
      ["h6", "clamp(0.8rem, 0.75rem + 0.3cqi, 0.875rem)"],
    ];
    for (const [level, clamp] of expected) {
      const html = renderToStaticMarkup(<HeadingBlock text="Test" level={level} />);
      expect(html, `${level} should contain ${clamp}`).toContain(clamp);
    }
  });

  it("tolerates a legacy {text} object via asText back-compat", () => {
    render(<HeadingBlock text={"Legacy heading"} level="h2" />);
    expect(screen.getByText("Legacy heading")).toBeTruthy();
  });

  it("renders with an empty text prop without crashing", () => {
    const { container } = render(<HeadingBlock text="" level="h2" />);
    expect(container).toBeTruthy();
  });

  it("wrapper div has no default padding", () => {
    const { container } = render(<HeadingBlock text="Test" level="h2" />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.padding).toBe("");
  });

  it("renders text without a <mark> when highlight is not set", () => {
    render(<HeadingBlock text="Plain heading" level="h2" />);
    expect(document.querySelector("mark")).toBeNull();
    expect(screen.getByText("Plain heading")).toBeTruthy();
  });

  it("h1 uses a fluid clamp font size when _style.fontSize is not set", () => {
    // JSDOM strips clamp() from font-size (CSS parsing limitation), so use renderToStaticMarkup.
    const html = renderToStaticMarkup(<HeadingBlock text="Test" level="h1" />);
    expect(html).toContain("clamp(");
    expect(html).toContain("cqi");
  });

  it("wraps text in <mark> when _style.highlight is true", () => {
    render(<HeadingBlock text="Highlighted heading" level="h2" _style={{ highlight: true }} />);
    const mark = document.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("Highlighted heading");
  });

  it("applies highlightToken color to the <mark> background", () => {
    render(
      <HeadingBlock
        text="Colored"
        level="h2"
        _style={{ highlight: true, highlightToken: "accent" }}
      />
    );
    const mark = document.querySelector("mark") as HTMLElement;
    expect(mark.style.background).toBe("var(--pf-color-accent)");
  });

  it("applies highlightShape 'rounded' border-radius to <mark>", () => {
    render(
      <HeadingBlock
        text="Rounded"
        level="h2"
        _style={{ highlight: true, highlightShape: "rounded" }}
      />
    );
    const mark = document.querySelector("mark") as HTMLElement;
    expect(mark.style.borderRadius).toBe("0.6em");
  });

  it("applies highlightSize 'lg' padding to <mark>", () => {
    render(
      <HeadingBlock
        text="Large"
        level="h2"
        _style={{ highlight: true, highlightSize: "lg" }}
      />
    );
    const mark = document.querySelector("mark") as HTMLElement;
    expect(mark.style.padding).toBe("0.2em 0.45em");
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

  it("wrapper div has no default padding", () => {
    const { container } = render(<TextBlock text="Test" />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.padding).toBe("");
  });

  it("renders text without a <mark> when highlight is not set", () => {
    render(<TextBlock text="Plain text" />);
    expect(document.querySelector("mark")).toBeNull();
    expect(screen.getByText("Plain text")).toBeTruthy();
  });

  it("wraps text in <mark> when _style.highlight is true", () => {
    render(<TextBlock text="Highlighted text" _style={{ highlight: true }} />);
    const mark = document.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("Highlighted text");
  });

  it("applies highlightToken color to the <mark> background", () => {
    render(<TextBlock text="Colored" _style={{ highlight: true, highlightToken: "primary" }} />);
    const mark = document.querySelector("mark") as HTMLElement;
    expect(mark.style.background).toBe("var(--pf-color-primary)");
  });

  it("applies highlightShape 'sharp' zero border-radius to <mark>", () => {
    render(<TextBlock text="Sharp" _style={{ highlight: true, highlightShape: "sharp" }} />);
    const mark = document.querySelector("mark") as HTMLElement;
    // jsdom normalises "0" to "0px" for borderRadius
    expect(mark.style.borderRadius).toBe("0px");
  });

  it("applies highlightSize 'sm' padding to <mark>", () => {
    render(<TextBlock text="Small" _style={{ highlight: true, highlightSize: "sm" }} />);
    const mark = document.querySelector("mark") as HTMLElement;
    expect(mark.style.padding).toBe("0.05em 0.2em");
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
    // NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH is not set in test env → imageDeliveryUrl returns ""
    render(<ImageBlock imagePublicId="gallurio/ws/img.jpg" imageUrl="" alt="" fit="cover" />);
    // Falls through to placeholder since cfImageUrl → null and imageUrl is empty
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

  it("a solid button IGNORES borderWidth/borderColorToken — deprecated in Pass 2", () => {
    // Named button styles (solid/soft/outline) no longer read borderWidth/borderColorToken.
    render(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "solid", borderWidth: 3, borderColorToken: "primary" }}
      />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.borderWidth).toBe("0px");
    expect(a.style.borderColor).toBe("transparent");
  });

  it("_style.radius set → button uses px borderRadius (not var(--pf-radius))", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" _style={{ radius: 8 }} />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.borderRadius).toBe("8px");
  });

  it("_style.radius unset → button falls back to var(--pf-radius) brand-kit radius", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.borderRadius).toBe("var(--pf-radius)");
  });

  it("_style.shadow is IGNORED for buttons — shadow was deprecated in Pass 2 (old data back-compat)", () => {
    // Shadow is no longer applied to buttons. Old saved buttons that carry `shadow`
    // simply have it ignored on render so pages don't break.
    render(<ButtonBlock label="Btn" action="open-contact" align="center" _style={{ shadow: "sm" }} />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.boxShadow).toBe("");
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

  it("defaults to medium size when no size prop is given", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.minHeight).toBe("2.75rem");
    expect(a.style.minWidth).toBe("9rem");
  });

  it("size='sm' applies small dimensions", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" size="sm" />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.minHeight).toBe("2rem");
    expect(a.style.minWidth).toBe("6rem");
    expect(a.style.fontSize).toBe("0.8125rem");
  });

  it("size='lg' applies large dimensions", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" size="lg" />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.minHeight).toBe("3.5rem");
    expect(a.style.minWidth).toBe("12rem");
    expect(a.style.fontSize).toBe("1.125rem");
  });

  it("buttonStyle='solid' fills background with colorVar and sets border transparent", () => {
    render(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "solid", buttonColorToken: "accent" }}
      />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.backgroundColor).toBe("var(--pf-color-accent)");
    expect(a.style.borderColor).toBe("transparent");
  });

  it("buttonStyle='outline' sets transparent background and colored border", () => {
    render(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "outline", buttonColorToken: "primary" }}
      />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.backgroundColor).toBe("transparent");
    expect(a.style.borderColor).toBe("var(--pf-color-primary)");
  });

  it("buttonStyle='soft' uses colorVar for text and sets border transparent", () => {
    render(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "soft", buttonColorToken: "accent" }}
      />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.color).toBe("var(--pf-color-accent)");
    expect(a.style.borderColor).toBe("transparent");
  });

  it("buttonStyle='solid' uses default primary colorVar when no buttonColorToken set", () => {
    render(
      <ButtonBlock label="Btn" action="open-contact" align="center" _style={{ buttonStyle: "solid" }} />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.backgroundColor).toBe("var(--pf-color-primary)");
  });

  it("textColorToken overrides automatic text color in buttonStyle='solid'", () => {
    render(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "solid", buttonColorToken: "accent", textColorToken: "secondary" }}
      />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.color).toBe("var(--pf-color-secondary)");
  });

  it("a soft button uses 0px border (borderWidth/borderColorToken deprecated in Pass 2)", () => {
    // Soft style: tinted fill at 15%, no border. Old _style.borderWidth data ignored.
    render(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "soft", borderWidth: 2, borderColorToken: "accent" }}
      />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.borderWidth).toBe("0px");
    expect(a.style.borderColor).toBe("transparent");
  });

  it("buttonOpacity=60 on solid: fill uses color-mix at 60%", () => {
    // jsdom silently drops color-mix() from inline style; use server markup to assert the raw CSS.
    const html = renderToStaticMarkup(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "solid", buttonColorToken: "primary", buttonOpacity: 60 }}
      />
    );
    expect(html).toContain(
      "background-color:color-mix(in srgb, var(--pf-color-primary) 60%, transparent)"
    );
  });

  it("buttonOpacity=100 on solid: fill is the raw CSS variable (no color-mix overhead)", () => {
    const html = renderToStaticMarkup(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "solid", buttonColorToken: "accent", buttonOpacity: 100 }}
      />
    );
    expect(html).toContain("background-color:var(--pf-color-accent)");
    expect(html).not.toContain("color-mix");
  });

  it("shadow in _style is IGNORED for buttons — no boxShadow applied to <a>", () => {
    render(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "solid", shadow: "lg" }}
      />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.boxShadow).toBe("");
  });

  it("borderWidth in _style is IGNORED for solid buttons — border is always 0px", () => {
    render(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "solid", borderWidth: 5, borderColorToken: "accent" }}
      />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.borderWidth).toBe("0px");
  });

  it("borderWidth in _style is IGNORED for outline buttons — always 2px with colorVar", () => {
    render(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "outline", buttonColorToken: "primary", borderWidth: 10 }}
      />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.borderWidth).toBe("2px");
    expect(a.style.borderColor).toBe("var(--pf-color-primary)");
  });

  it("borderWidth in _style is IGNORED for soft buttons — always 0px/transparent", () => {
    render(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "soft", borderWidth: 2, borderColorToken: "accent" }}
      />
    );
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.borderWidth).toBe("0px");
    expect(a.style.borderColor).toBe("transparent");
  });

  it("buttonOpacity on soft: soft retains its fixed 15% tint and intentionally ignores buttonOpacity", () => {
    // Soft always uses the 15% tint; buttonOpacity is intentionally not applied on top.
    const html = renderToStaticMarkup(
      <ButtonBlock
        label="Btn"
        action="open-contact"
        align="center"
        _style={{ buttonStyle: "soft", buttonColorToken: "accent", buttonOpacity: 50 }}
      />
    );
    expect(html).toContain("color-mix(in srgb, var(--pf-color-accent) 15%, transparent)");
  });
});

// ---------------------------------------------------------------------------
// TextBlock / HeadingBlock — color fallback (parity)
// ---------------------------------------------------------------------------

describe("TextBlock and HeadingBlock color parity", () => {
  it("TextBlock with no _style has outer div color: var(--pf-color-fg)", () => {
    const { container } = render(<TextBlock text="Hello" />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.color).toBe("var(--pf-color-fg)");
  });

  it("HeadingBlock with no _style has outer div color: var(--pf-color-fg)", () => {
    const { container } = render(<HeadingBlock text="Hi" level="h2" />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.color).toBe("var(--pf-color-fg)");
  });

  it("TextBlock with explicit textColorToken:'primary' has outer div color: var(--pf-color-primary)", () => {
    const { container } = render(<TextBlock text="Hello" _style={{ textColorToken: "primary" }} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.color).toBe("var(--pf-color-primary)");
  });

  it("HeadingBlock with explicit textColorToken:'primary' has outer div color: var(--pf-color-primary)", () => {
    const { container } = render(<HeadingBlock text="Hi" level="h2" _style={{ textColorToken: "primary" }} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.color).toBe("var(--pf-color-primary)");
  });

  it("ButtonBlock with no _style uses var(--pf-color-fg) for text (legacy fallback)", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.color).toBe("var(--pf-color-fg)");
  });

  it("ButtonBlock solid style with no textColorToken uses var(--pf-color-bg) for text", () => {
    render(<ButtonBlock label="Btn" action="open-contact" align="center" _style={{ buttonStyle: "solid" }} />);
    const a = document.querySelector("a") as HTMLAnchorElement;
    expect(a.style.color).toBe("var(--pf-color-bg)");
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

  it("slot receives the per-instance grid class (A1: class is pf-cols-inst when no Puck id in tests)", () => {
    render(<ColumnsBlock columns={2} content={stubSlot} />);
    const slot = screen.getByTestId("slot");
    // After per-instance scoping: class is pf-cols-<instanceId>; tests fall back to "inst".
    expect(slot.className).toContain("pf-cols-inst");
    // Column count is now in the CSS rules, not in the class name.
    expect(slot.className).not.toContain("pf-cols-2");
  });

  it("instance class is same for all column counts — count is in @container CSS rule (A1)", () => {
    render(<ColumnsBlock columns={3} content={stubSlot} />);
    const slot = screen.getByTestId("slot");
    expect(slot.className).toContain("pf-cols-inst");
    expect(slot.className).not.toContain("pf-cols-3");
  });

  it("columns=7 clamps to 6: CSS @container rule uses repeat(6,...) (A1)", () => {
    const html = renderToStaticMarkup(<ColumnsBlock columns={7} content={stubSlot} />);
    expect(html).toContain("repeat(6,minmax(0,1fr))");
  });

  it("rows=3 adds the per-instance rows class to the slot element (A1)", () => {
    render(<ColumnsBlock columns={2} rows={3} content={stubSlot} />);
    const slot = screen.getByTestId("slot");
    // Per-instance rows class: pf-cols-rows-inst when no Puck id in tests.
    expect(slot.className).toContain("pf-cols-rows-inst");
    expect(slot.className).not.toContain("pf-cols-rows-3");
  });

  it("rows=1 does NOT add a rows class (auto-row behaviour preserved)", () => {
    render(<ColumnsBlock columns={2} rows={1} content={stubSlot} />);
    const slot = screen.getByTestId("slot");
    expect(slot.className).not.toContain("pf-cols-rows-");
  });

  it("columns=1 renders with the per-instance grid class (A1)", () => {
    render(<ColumnsBlock columns={1 as number} content={stubSlot} />);
    const slot = screen.getByTestId("slot");
    expect(slot.className).toContain("pf-cols-inst");
  });

  it("columns=4 renders with the per-instance grid class (A1)", () => {
    render(<ColumnsBlock columns={4} content={stubSlot} />);
    const slot = screen.getByTestId("slot");
    expect(slot.className).toContain("pf-cols-inst");
  });

  it("each Columns instance uses a unique containerName derived from its Puck id (A1)", () => {
    const html1 = renderToStaticMarkup(<ColumnsBlock id="Columns-aaa" columns={2} content={stubSlot} />);
    const html2 = renderToStaticMarkup(<ColumnsBlock id="Columns-bbb" columns={2} content={stubSlot} />);
    expect(html1).toContain("pfcols-Columns-aaa");
    expect(html2).toContain("pfcols-Columns-bbb");
    expect(html1).not.toContain("pfcols-Columns-bbb");
    expect(html2).not.toContain("pfcols-Columns-aaa");
  });

  it("columns=6 generates repeat(6,...) in the desktop CSS rule", () => {
    const html = renderToStaticMarkup(<ColumnsBlock columns={6} content={stubSlot} />);
    expect(html).toContain("repeat(6,minmax(0,1fr))");
  });

  it("rows=undefined produces no grid-template-rows rule (auto-flow)", () => {
    const html = renderToStaticMarkup(<ColumnsBlock columns={2} rows={undefined} content={stubSlot} />);
    expect(html).not.toContain("grid-template-rows");
  });

  it("rows=3 produces grid-template-rows:repeat(3,...) in the style tag", () => {
    const html = renderToStaticMarkup(<ColumnsBlock columns={2} rows={3} content={stubSlot} />);
    expect(html).toContain("grid-template-rows:repeat(3,minmax(0,auto))");
  });

  it("multi-column grid uses container queries (not viewport media queries) so colSpan works inside narrow editor canvases", () => {
    // colSpan only takes effect when the parent defines N tracks. If the grid uses
    // viewport min-width, an editor canvas narrower than the breakpoint never fires the
    // desktop rule, so span N has no tracks to span. Container queries key off the
    // block's own width instead of the viewport.
    const html = renderToStaticMarkup(<ColumnsBlock columns={3} content={stubSlot} />);
    expect(html).toContain("@container");
    expect(html).not.toMatch(/@media\s*\(min-width/);
  });

  it("PUBLIC breakpoints keep a 375px phone single-column: first breakpoint is >327px", () => {
    // A 375px phone has ~327px of available container width inside typical page padding.
    // The first @container breakpoint must be above 327px so the grid stays 1 column
    // on phones. The editor handles its narrow canvas separately via puck.isEditing,
    // not by lowering these public breakpoints.
    const html = renderToStaticMarkup(<ColumnsBlock columns={2} content={stubSlot} />);
    const breakpoints = [...html.matchAll(/@container[^{]+\(min-width:\s*(\d+)px\)/g)]
      .map((m) => parseInt(m[1], 10));
    expect(breakpoints.length).toBeGreaterThan(0);
    // All public breakpoints must be above the phone container width (~327px).
    breakpoints.forEach((bp) => expect(bp).toBeGreaterThan(327));
  });

  it("editor-mode with rows=3: inline gridTemplateRows injected so rows are WYSIWYG in canvas (A2)", () => {
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} rows={3} content={stubSlot} puck={{ isEditing: true }} />
    );
    expect(html).toContain("grid-template-rows");
    expect(html).toContain("repeat(3,minmax(0,auto))");
  });

  it("editor-mode (puck.isEditing=true): 2-col block gets inline grid-template-columns for direct column preview", () => {
    // When isEditing=true, the block injects a direct gridTemplateColumns so the user
    // sees the actual column count in the narrow editor canvas (~428px), bypassing the
    // container-query breakpoints which require the container to be >=480px.
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} content={stubSlot} puck={{ isEditing: true }} />
    );
    // React serializes { gridTemplateColumns: "..." } as "grid-template-columns:..." in HTML.
    expect(html).toContain("grid-template-columns");
    expect(html).toContain("repeat(2,minmax(0,1fr))");
  });

  it("render-mode (puck.isEditing=false): 2-col block does NOT inject inline grid-template-columns (uses @container rules)", () => {
    // On the public page puck.isEditing is false; the grid relies on container queries
    // so it is responsive (1-col on mobile, multi-col on wider containers).
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} content={stubSlot} puck={{ isEditing: false }} />
    );
    // The @container rule is in the <style> tag but the slot element should have no
    // inline grid-template-columns style (style prop is empty object → no style attr).
    // The ONLY occurrence of grid-template-columns should be inside the <style> tag.
    expect(html).not.toMatch(/class="pf-cols[^"]*"[^>]*style="[^"]*grid-template-columns/);
  });
});

describe("HeadingBlock — dragRef forwarding", () => {
  it("forwards puck.dragRef to the root div element", () => {
    let capturedEl: Element | null = null;
    const dragRef = (el: Element | null) => { capturedEl = el; };
    render(<HeadingBlock text="Test" level="h2" puck={{ dragRef }} />);
    expect(capturedEl).not.toBeNull();
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
  const MockSlot: SlotComponent = (props) => (
    <div data-testid="slot-inner" data-min-empty={String(props?.minEmptyHeight ?? "")} style={props?.style} />
  );

  it("renders the outer section with flexGrow: 1", () => {
    const { container } = render(<ContainerBlock content={MockSlot} />);
    const section = container.querySelector("section");
    expect(section?.style.flexGrow).toBe("1");
  });

  it("editor mode: empty drop zone gets Puck's native minEmptyHeight so the whole area is droppable", () => {
    render(<ContainerBlock content={MockSlot} minHeight="short" puck={{ isEditing: true }} />);
    const inner = screen.getByTestId("slot-inner");
    // short -> 320px editor footprint (CONTAINER_EDITOR_HEIGHT_PX).
    expect(inner.getAttribute("data-min-empty")).toBe("320");
  });

  it("public page: drop zone gets NO minEmptyHeight so layout is content-sized (unchanged)", () => {
    render(<ContainerBlock content={MockSlot} minHeight="short" puck={{ isEditing: false }} />);
    const inner = screen.getByTestId("slot-inner");
    expect(inner.getAttribute("data-min-empty")).toBe("");
  });

  it("auto-height container gets an editor px min-height when editing (droppable footprint)", () => {
    const { container } = render(
      <ContainerBlock content={MockSlot} minHeight="auto" puck={{ isEditing: true }} />
    );
    const section = container.querySelector("section");
    expect(section?.style.minHeight).toBe("128px");
  });

  it("does NOT apply the editor minHeight on the public page (auto container)", () => {
    const { container } = render(
      <ContainerBlock content={MockSlot} minHeight="auto" puck={{ isEditing: false }} />
    );
    const section = container.querySelector("section");
    expect(section?.style.minHeight).toBe("");
  });

  it("tall container renders its editor px height in edit mode (vh on the public page)", () => {
    const { container } = render(
      <ContainerBlock content={MockSlot} minHeight="tall" puck={{ isEditing: true }} />
    );
    const section = container.querySelector("section");
    // Editor uses px so it can feed Puck's minEmptyHeight; public page keeps 80vh.
    expect(section?.style.minHeight).toBe("640px");
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

  it("_style.align overrides alignX for inner content wrapper textAlign", () => {
    render(
      <ContainerBlock content={MockSlot} alignX="left" _style={{ align: "right" }} />
    );
    const inner = screen.getByTestId("slot-inner");
    // _style.align: "right" takes priority over alignX: "left"
    expect(inner.style.textAlign).toBe("right");
  });

  it("_style.align takes priority over _style.alignItems for textAlign", () => {
    render(
      <ContainerBlock content={MockSlot} alignX="left" _style={{ align: "center", alignItems: "end" }} />
    );
    const inner = screen.getByTestId("slot-inner");
    // _style.align wins — alignItems would map to "right", but align is "center"
    expect(inner.style.textAlign).toBe("center");
  });

  it("applies _style.gap to the inner content wrapper", () => {
    render(<ContainerBlock content={MockSlot} _style={{ gap: 32 }} />);
    const inner = screen.getByTestId("slot-inner");
    expect(inner.style.gap).toBe("32px");
  });
});

// ---------------------------------------------------------------------------
// ContainerBlock — background slideshow branch
// ---------------------------------------------------------------------------

describe("ContainerBlock background images", () => {
  const Slot: SlotComponent = (props) => <div data-testid="slot-inner" style={props?.style} />;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH", "test-hash");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders no background layer when backgroundImages is empty", () => {
    const { container } = render(<ContainerBlock content={Slot} backgroundImages={[]} />);
    expect(container.querySelector("[data-bg-slideshow]")).toBeNull();
    // No absolutely-positioned background <img> either.
    expect(container.querySelector('section > img')).toBeNull();
  });

  it("renders a single static <img> (no slideshow island) for exactly one image", () => {
    const { container } = render(
      <ContainerBlock content={Slot} backgroundImages={[{ id: "a", publicId: "ws/a" }]} />
    );
    expect(container.querySelector("[data-bg-slideshow]")).toBeNull();
    const img = container.querySelector("section > img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute("aria-hidden")).toBe("true");
    expect(img!.src).toContain("ws/a");
  });

  it("renders the slideshow island for two or more images", () => {
    const { container } = render(
      <ContainerBlock
        content={Slot}
        backgroundImages={[{ id: "a", publicId: "ws/a" }, { id: "b", publicId: "ws/b" }]}
        bgAnimation="slide"
        bgSpeed="fast"
      />
    );
    const island = container.querySelector("[data-bg-slideshow]");
    expect(island).not.toBeNull();
    expect(island?.getAttribute("data-animation")).toBe("slide");
    expect(container.querySelectorAll("[data-bg-layer]").length).toBe(2);
  });

  it("layers the dark scrim above the slideshow when overlayOpacity > 0", () => {
    const { container } = render(
      <ContainerBlock
        content={Slot}
        backgroundImages={[{ id: "a", publicId: "ws/a" }, { id: "b", publicId: "ws/b" }]}
        overlayOpacity={50}
      />
    );
    const scrim = container.querySelector('section > div[aria-hidden="true"]:not([data-bg-slideshow])') as HTMLElement | null;
    expect(scrim).not.toBeNull();
    expect(scrim!.style.backgroundColor).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("keeps the content slot rendered above the background (z-index 1)", () => {
    render(
      <ContainerBlock
        content={Slot}
        backgroundImages={[{ id: "a", publicId: "ws/a" }, { id: "b", publicId: "ws/b" }]}
      />
    );
    const inner = screen.getByTestId("slot-inner");
    expect(inner.style.zIndex).toBe("1");
  });
});

describe("ColumnsBlock — dragRef forwarding", () => {
  it("forwards puck.dragRef to the root div element", () => {
    let capturedEl: Element | null = null;
    const dragRef = (el: Element | null) => { capturedEl = el; };
    const stubSlot: SlotComponent = () => <div />;
    render(<ColumnsBlock columns={2} content={stubSlot} puck={{ dragRef }} />);
    expect(capturedEl).not.toBeNull();
  });
});

describe("ContainerBlock — dragRef forwarding", () => {
  it("forwards puck.dragRef to the root section element", () => {
    let capturedEl: Element | null = null;
    const dragRef = (el: Element | null) => { capturedEl = el; };
    const stubSlot: SlotComponent = () => <div />;
    render(<ContainerBlock content={stubSlot} puck={{ dragRef }} />);
    expect(capturedEl).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Item 4: defaultProps gap default
// ---------------------------------------------------------------------------

describe("defaultProps gap default (Item 4)", () => {
  it("columnsDefaultProps._style.gap is 16 (16px = 1rem, matches fallback)", () => {
    expect(columnsDefaultProps._style?.gap).toBe(16);
  });

  it("ColumnsBlock renders 16px gap (same as old 1rem fallback) when gap=16 is set", () => {
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} content={stubSlot} _style={{ paddingTop: "1rem", gap: 16 }} />,
    );
    expect(html).toContain("gap:16px");
  });

  it("ColumnsBlock still renders 1rem gap via fallback when _style.gap is undefined (old saved pages)", () => {
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} content={stubSlot} _style={{}} />,
    );
    expect(html).toContain("gap:1rem");
  });
});

// ---------------------------------------------------------------------------
// Item 4: defaultProps bgAnimation/bgSpeed
// ---------------------------------------------------------------------------

describe("defaultProps bgAnimation/bgSpeed (Item 4)", () => {
  it("containerDefaultProps has bgAnimation='crossfade' and bgSpeed='medium'", () => {
    expect(containerDefaultProps.bgAnimation).toBe("crossfade");
    expect(containerDefaultProps.bgSpeed).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// B2a: Container/Columns padding — effective-default DISPLAY (prop stays unset)
// ---------------------------------------------------------------------------

describe("B2a: containerDefaultProps carries no padding (de-materialized)", () => {
  it("containerDefaultProps._style has no paddingTop", () => {
    expect(containerDefaultProps._style?.paddingTop).toBeUndefined();
  });
  it("containerDefaultProps._style has no paddingRight", () => {
    expect(containerDefaultProps._style?.paddingRight).toBeUndefined();
  });
  it("containerDefaultProps._style has no paddingBottom", () => {
    expect(containerDefaultProps._style?.paddingBottom).toBeUndefined();
  });
  it("containerDefaultProps._style has no paddingLeft", () => {
    expect(containerDefaultProps._style?.paddingLeft).toBeUndefined();
  });
});

describe("B2a: columnsDefaultProps carries no padding (de-materialized)", () => {
  it("columnsDefaultProps._style has no paddingTop", () => {
    expect(columnsDefaultProps._style?.paddingTop).toBeUndefined();
  });
  it("columnsDefaultProps._style has no paddingRight", () => {
    expect(columnsDefaultProps._style?.paddingRight).toBeUndefined();
  });
  it("columnsDefaultProps._style has no paddingBottom", () => {
    expect(columnsDefaultProps._style?.paddingBottom).toBeUndefined();
  });
  it("columnsDefaultProps._style has no paddingLeft", () => {
    expect(columnsDefaultProps._style?.paddingLeft).toBeUndefined();
  });
});

describe("B2a: ContainerBlock render — fallback padding (parity)", () => {
  it("renders paddingTop 1.5rem when _style is undefined", () => {
    const html = renderToStaticMarkup(
      <ContainerBlock content={stubSlot} />,
    );
    expect(html).toContain("padding-top:1.5rem");
  });
  it("renders all four sides 1.5rem when _style is undefined", () => {
    const html = renderToStaticMarkup(
      <ContainerBlock content={stubSlot} />,
    );
    expect(html).toContain("padding-top:1.5rem");
    expect(html).toContain("padding-right:1.5rem");
    expect(html).toContain("padding-bottom:1.5rem");
    expect(html).toContain("padding-left:1.5rem");
  });
  it("explicit _style.paddingTop overrides the fallback", () => {
    const html = renderToStaticMarkup(
      <ContainerBlock content={stubSlot} _style={{ paddingTop: "3rem" }} />,
    );
    expect(html).toContain("padding-top:3rem");
  });
});

describe("A5: ContainerBlock custom min-height", () => {
  it("public page: minHeight=custom + minHeightValue=250px renders min-height:250px (A5)", () => {
    const html = renderToStaticMarkup(
      <ContainerBlock content={stubSlot} minHeight="custom" minHeightValue="250px" puck={{ isEditing: false }} />
    );
    expect(html).toContain("min-height:250px");
  });

  it("public page: minHeight=custom without minHeightValue has no min-height constraint (A5)", () => {
    const html = renderToStaticMarkup(
      <ContainerBlock content={stubSlot} minHeight="custom" puck={{ isEditing: false }} />
    );
    expect(html).not.toContain("min-height");
  });
});

describe("A7: ColumnsBlock overallWidth prop", () => {
  it("overallWidth=full applies full-bleed CSS on the outer wrapper (A7)", () => {
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} overallWidth="full" content={stubSlot} />
    );
    expect(html).toContain("width:100vw");
  });
});

describe("A5: ColumnsBlock min-height prop", () => {
  it("renders min-height when minHeight prop is set (A5)", () => {
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} minHeight="200px" content={stubSlot} />
    );
    expect(html).toContain("min-height:200px");
  });
});

describe("#2: ColumnsBlock grid — align-items stretch for public-page parity", () => {
  it("base grid CSS rule contains align-items:stretch so public-page sibling cells fill the row track (Bug #2)", () => {
    const html = renderToStaticMarkup(<ColumnsBlock columns={5} content={stubSlot} />);
    expect(html).toContain("align-items:stretch");
  });

  it("@container rows rule and editor inline gridTemplateRows use identical track sizing (Bug #2 parity)", () => {
    const publicHtml = renderToStaticMarkup(
      <ColumnsBlock columns={5} rows={2} content={stubSlot} puck={{ isEditing: false }} />
    );
    const editorHtml = renderToStaticMarkup(
      <ColumnsBlock columns={5} rows={2} content={stubSlot} puck={{ isEditing: true }} />
    );
    const containerMatch = publicHtml.match(/grid-template-rows:repeat\(\d+,([^}]+?)\)/);
    const inlineMatch = editorHtml.match(/grid-template-rows:repeat\(\d+,([^"]+?)\)/);
    expect(containerMatch).not.toBeNull();
    expect(inlineMatch).not.toBeNull();
    expect(containerMatch![1]).toBe(inlineMatch![1]);
  });
});

describe("#9: ColumnsBlock overallWidth full — editor canvas constraint", () => {
  it("overallWidth=full in editor context: outer wrapper uses width:100% not 100vw (Bug #9)", () => {
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} overallWidth="full" content={stubSlot} puck={{ isEditing: true }} />
    );
    expect(html).not.toContain("width:100vw");
    expect(html).toContain("width:100%");
  });

  it("overallWidth=full on the public page: outer wrapper uses width:100vw (true full-bleed preserved)", () => {
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} overallWidth="full" content={stubSlot} puck={{ isEditing: false }} />
    );
    expect(html).toContain("width:100vw");
    expect(html).not.toContain("width:100%");
  });
});

describe("B2a: ColumnsBlock render — fallback padding (parity)", () => {
  it("renders top/bottom 1rem, left/right 1.5rem when _style has no padding", () => {
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} content={stubSlot} />,
    );
    expect(html).toContain("padding-top:1rem");
    expect(html).toContain("padding-right:1.5rem");
    expect(html).toContain("padding-bottom:1rem");
    expect(html).toContain("padding-left:1.5rem");
  });
  it("explicit _style.paddingTop overrides the fallback", () => {
    const html = renderToStaticMarkup(
      <ColumnsBlock columns={2} content={stubSlot} _style={{ paddingTop: "3rem" }} />,
    );
    expect(html).toContain("padding-top:3rem");
  });
});
