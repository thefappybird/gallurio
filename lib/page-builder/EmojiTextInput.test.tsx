import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { insertAtCaret, EmojiButton } from "./EmojiTextInput";
import React from "react";

describe("insertAtCaret", () => {
  it("inserts emoji at the end when no selection", () => {
    const el = document.createElement("input");
    el.value = "Hello";
    el.selectionStart = 5;
    el.selectionEnd = 5;
    const result = insertAtCaret(el, "👋");
    expect(result).toBe("Hello👋");
  });

  it("inserts emoji at caret position mid-string", () => {
    const el = document.createElement("input");
    el.value = "Hello World";
    el.selectionStart = 5;
    el.selectionEnd = 5;
    const result = insertAtCaret(el, "✨");
    expect(result).toBe("Hello✨ World");
  });

  it("replaces selected text with emoji", () => {
    const el = document.createElement("input");
    el.value = "Hello REPLACE World";
    el.selectionStart = 6;
    el.selectionEnd = 13;
    const result = insertAtCaret(el, "🎉");
    expect(result).toBe("Hello 🎉 World");
  });
});

describe("EmojiButton", () => {
  it("renders a button with aria-label 'Insert emoji'", () => {
    const inputRef = React.createRef<HTMLInputElement>();
    const onChange = vi.fn();
    render(
      <>
        <input ref={inputRef} defaultValue="" />
        <EmojiButton inputRef={inputRef} onChange={onChange} />
      </>
    );
    expect(screen.getByRole("button", { name: "Insert emoji" })).toBeTruthy();
  });

  it("clicking the button calls onChange with selected emoji", async () => {
    const inputRef = React.createRef<HTMLInputElement>();
    const onChange = vi.fn();
    render(
      <>
        <input ref={inputRef} defaultValue="Hello" />
        <EmojiButton inputRef={inputRef} onChange={onChange} />
      </>
    );
    fireEvent.click(screen.getByRole("button", { name: "Insert emoji" }));
    // after popover opens, click the first emoji button
    const emojiBtns = await screen.findAllByRole("button", { name: /^[\u{1F300}-\u{1FFFF}]/u });
    fireEvent.click(emojiBtns[0]);
    expect(onChange).toHaveBeenCalledOnce();
  });
});
