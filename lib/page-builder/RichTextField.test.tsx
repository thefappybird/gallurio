import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RichTextField } from "./RichTextField";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderField(value: unknown = "", onChange = vi.fn()) {
  return {
    onChange,
    ...render(<RichTextField value={value} onChange={onChange} />),
  };
}

// ---------------------------------------------------------------------------
// Value coercion / rendering
// ---------------------------------------------------------------------------

describe("RichTextField — initial render", () => {
  it("renders an input element", () => {
    renderField("");
    expect(document.querySelector("input[type='text']")).not.toBeNull();
  });

  it("shows the text value from a RichText object", () => {
    renderField({ text: "Hello World" });
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    expect(input.value).toBe("Hello World");
  });

  it("shows the text from a legacy plain string", () => {
    renderField("Legacy string");
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    expect(input.value).toBe("Legacy string");
  });

  it("shows empty value from undefined", () => {
    renderField(undefined);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("shows empty value from null", () => {
    renderField(null);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("renders with a placeholder when provided", () => {
    render(<RichTextField value="" onChange={vi.fn()} placeholder="Enter text…" />);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    expect(input.placeholder).toBe("Enter text…");
  });
});

// ---------------------------------------------------------------------------
// Toolbar visibility: hidden until focused
// ---------------------------------------------------------------------------

describe("RichTextField — toolbar visibility", () => {
  it("toolbar is HIDDEN initially (Bold button not in document)", () => {
    renderField({ text: "Some text" });
    expect(screen.queryByRole("button", { name: /bold/i })).toBeNull();
  });

  it("toolbar APPEARS after the input receives focus", () => {
    renderField({ text: "Some text" });
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(input);
    expect(screen.getByRole("button", { name: /bold/i })).toBeTruthy();
  });

  it("toolbar APPEARS and shows Italic button after focus", () => {
    renderField({ text: "text" });
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(input);
    expect(screen.getByRole("button", { name: /italic/i })).toBeTruthy();
  });

  it("toolbar APPEARS and shows Underline button after focus", () => {
    renderField({ text: "text" });
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(input);
    expect(screen.getByRole("button", { name: /underline/i })).toBeTruthy();
  });

  it("toolbar shows alignment buttons after focus", () => {
    renderField({ text: "text" });
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(input);
    expect(screen.getByRole("button", { name: /align left/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /align center/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /align right/i })).toBeTruthy();
  });

  it("toolbar hides after blur leaves the wrapper", () => {
    const { container } = renderField({ text: "text" });
    const input = document.querySelector("input[type='text']") as HTMLInputElement;

    fireEvent.focus(input);
    expect(screen.getByRole("button", { name: /bold/i })).toBeTruthy();

    // Simulate blur where relatedTarget is null (focus left the component entirely)
    const wrapper = container.firstChild as HTMLElement;
    fireEvent.blur(wrapper, { relatedTarget: null });
    expect(screen.queryByRole("button", { name: /bold/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Typing — calls onChange with updated text
// ---------------------------------------------------------------------------

describe("RichTextField — text changes", () => {
  it("calls onChange with {text: <new value>} when the user types", () => {
    const onChange = vi.fn();
    render(<RichTextField value={{ text: "old" }} onChange={onChange} />);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "new value" } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].text).toBe("new value");
  });

  it("preserves the existing style when text changes", () => {
    const onChange = vi.fn();
    render(
      <RichTextField value={{ text: "original", style: { bold: true } }} onChange={onChange} />
    );
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "updated" } });
    expect(onChange.mock.calls[0][0].text).toBe("updated");
    expect(onChange.mock.calls[0][0].style?.bold).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bold toggle — sets style.bold via the toolbar button
// ---------------------------------------------------------------------------

describe("RichTextField — Bold toggle", () => {
  it("clicking Bold calls onChange with style.bold=true when currently false", () => {
    const onChange = vi.fn();
    render(<RichTextField value={{ text: "hi", style: { bold: false } }} onChange={onChange} />);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(input);

    const boldBtn = screen.getByRole("button", { name: /bold/i });
    fireEvent.click(boldBtn);

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].style?.bold).toBe(true);
  });

  it("clicking Bold again toggles style.bold back to false", () => {
    const onChange = vi.fn();
    render(<RichTextField value={{ text: "hi", style: { bold: true } }} onChange={onChange} />);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(input);

    const boldBtn = screen.getByRole("button", { name: /bold/i });
    // bold is currently true; click toggles to false
    fireEvent.click(boldBtn);

    expect(onChange.mock.calls[0][0].style?.bold).toBe(false);
  });

  it("Bold button has aria-pressed=true when style.bold is set", () => {
    render(<RichTextField value={{ text: "hi", style: { bold: true } }} onChange={vi.fn()} />);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(input);

    const boldBtn = screen.getByRole("button", { name: /bold/i });
    expect(boldBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("Bold button has aria-pressed=false when style.bold is not set", () => {
    render(<RichTextField value={{ text: "hi" }} onChange={vi.fn()} />);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(input);

    const boldBtn = screen.getByRole("button", { name: /bold/i });
    expect(boldBtn.getAttribute("aria-pressed")).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// Italic and Underline toggles
// ---------------------------------------------------------------------------

describe("RichTextField — Italic toggle", () => {
  it("clicking Italic calls onChange with style.italic=true", () => {
    const onChange = vi.fn();
    render(<RichTextField value={{ text: "test" }} onChange={onChange} />);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(input);

    fireEvent.click(screen.getByRole("button", { name: /italic/i }));
    expect(onChange.mock.calls[0][0].style?.italic).toBe(true);
  });
});

describe("RichTextField — Underline toggle", () => {
  it("clicking Underline calls onChange with style.underline=true", () => {
    const onChange = vi.fn();
    render(<RichTextField value={{ text: "test" }} onChange={onChange} />);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(input);

    fireEvent.click(screen.getByRole("button", { name: /underline/i }));
    expect(onChange.mock.calls[0][0].style?.underline).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Multiline mode — textarea instead of input
// ---------------------------------------------------------------------------

describe("RichTextField — multiline mode", () => {
  it("renders a textarea when multiline=true", () => {
    render(<RichTextField value="" onChange={vi.fn()} multiline />);
    expect(document.querySelector("textarea")).not.toBeNull();
    expect(document.querySelector("input[type='text']")).toBeNull();
  });

  it("calls onChange when user types in textarea", () => {
    const onChange = vi.fn();
    render(<RichTextField value={{ text: "line" }} onChange={onChange} multiline />);
    const ta = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "line\ntwo" } });
    expect(onChange.mock.calls[0][0].text).toBe("line\ntwo");
  });
});
