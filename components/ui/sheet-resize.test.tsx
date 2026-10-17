import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { enMessages } from "@/test-utils/messages";
import { SheetResizeHandle, useSheetResize } from "./sheet-resize";

function Harness({ min }: { min?: number }) {
  const resize = useSheetResize({ storageKey: "gw:sheet-w:test", defaultWidth: 448, min });
  return (
    <div data-testid="sheet" {...resize.sheetProps}>
      <SheetResizeHandle resize={resize} />
    </div>
  );
}

function renderHarness(min?: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness min={min} />
    </NextIntlClientProvider>
  );
}

describe("useSheetResize", () => {
  it("starts at the default width", () => {
    renderHarness();
    expect(screen.getByTestId("sheet").style.getPropertyValue("--sheet-w")).toBe("448px");
    expect(screen.getByRole("separator", { name: "Resize panel" })).toHaveAttribute("aria-valuenow", "448");
  });

  it("renders an aria-hidden grip with three dots", () => {
    renderHarness();
    const grip = screen.getByRole("separator").querySelector('[data-slot="sheet-resize-grip"]');
    expect(grip).toHaveAttribute("aria-hidden", "true");
    expect(grip?.children).toHaveLength(3);
  });

  it("restores a persisted width", () => {
    window.localStorage.setItem("gw:sheet-w:test", "520");
    renderHarness();
    expect(screen.getByTestId("sheet").style.getPropertyValue("--sheet-w")).toBe("520px");
    window.localStorage.clear();
  });

  it("clamps a persisted width to min and 90% of the viewport", () => {
    window.localStorage.setItem("gw:sheet-w:test", "5000");
    const { unmount } = renderHarness();
    expect(screen.getByTestId("sheet").style.getPropertyValue("--sheet-w")).toBe(`${Math.floor(window.innerWidth * 0.9)}px`);
    unmount();
    window.localStorage.setItem("gw:sheet-w:test", "100");
    renderHarness();
    expect(screen.getByTestId("sheet").style.getPropertyValue("--sheet-w")).toBe("360px");
    window.localStorage.clear();
  });

  it("keyboard resizes the left-edge handle and persists each step", () => {
    renderHarness();
    const handle = screen.getByRole("separator");
    const width = () => screen.getByTestId("sheet").style.getPropertyValue("--sheet-w");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(width()).toBe("480px");
    expect(window.localStorage.getItem("gw:sheet-w:test")).toBe("480");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(width()).toBe("448px");
    fireEvent.keyDown(handle, { key: "Home" });
    expect(width()).toBe("360px");
    fireEvent.keyDown(handle, { key: "End" });
    expect(width()).toBe(`${Math.floor(window.innerWidth * 0.9)}px`);
    window.localStorage.clear();
  });

  it("drag writes via rAF only and commits state + storage once on pointerup", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const setItem = vi.spyOn(window.localStorage, "setItem");
    renderHarness();
    const sheet = screen.getByTestId("sheet");
    const handle = screen.getByRole("separator");

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 576 });
    expect(sheet).toHaveAttribute("data-resizing");
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 424 });
    frames.splice(0).forEach((cb) => cb(0));
    expect(sheet.style.getPropertyValue("--sheet-w")).toBe("600px");
    expect(handle).toHaveAttribute("aria-valuenow", "448");
    expect(setItem).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 424 });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith("gw:sheet-w:test", "600");
    expect(handle).toHaveAttribute("aria-valuenow", "600");
    expect(sheet).not.toHaveAttribute("data-resizing");

    setItem.mockRestore();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("restores body user-select and cancels the pending frame when unmounted mid-drag", () => {
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", () => 42);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const { unmount } = renderHarness();
    const handle = screen.getByRole("separator");

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 576 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500 });
    expect(document.body.style.userSelect).toBe("none");

    unmount();
    expect(document.body.style.userSelect).toBe("");
    expect(cancel).toHaveBeenCalledWith(42);

    vi.unstubAllGlobals();
  });

  it("survives localStorage throwing", () => {
    const get = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderHarness();
    fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowLeft" });
    expect(screen.getByTestId("sheet").style.getPropertyValue("--sheet-w")).toBe("480px");
    get.mockRestore();
    set.mockRestore();
  });
});
