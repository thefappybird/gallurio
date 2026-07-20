import { describe, it, expect } from "vitest";
import { isEditableTarget, isSelfManagedComboboxTarget } from "./editableTarget";

describe("isEditableTarget", () => {
  it("returns true for an input element", () => {
    const el = document.createElement("input");
    expect(isEditableTarget(el)).toBe(true);
  });

  it("returns true for a textarea element", () => {
    const el = document.createElement("textarea");
    expect(isEditableTarget(el)).toBe(true);
  });

  it("returns true for a select element", () => {
    const el = document.createElement("select");
    expect(isEditableTarget(el)).toBe(true);
  });

  it("returns true for a contenteditable div", () => {
    const el = document.createElement("div");
    el.setAttribute("contenteditable", "true");
    expect(isEditableTarget(el)).toBe(true);
  });

  it("returns false for a regular div", () => {
    const el = document.createElement("div");
    expect(isEditableTarget(el)).toBe(false);
  });

  it("returns false for a button", () => {
    const el = document.createElement("button");
    expect(isEditableTarget(el)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("isSelfManagedComboboxTarget", () => {
  it("returns true for an input with role=combobox", () => {
    const el = document.createElement("input");
    el.setAttribute("role", "combobox");
    expect(isSelfManagedComboboxTarget(el)).toBe(true);
  });

  it("returns false for a plain input without role=combobox", () => {
    const el = document.createElement("input");
    expect(isSelfManagedComboboxTarget(el)).toBe(false);
  });
});
