import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useLemonSqueezyCheckout } from "./use-lemon-squeezy-checkout";

const urlOpenMock = vi.fn();
const createLemonSqueezyMock = vi.fn();

beforeEach(() => {
  urlOpenMock.mockReset();
  createLemonSqueezyMock.mockReset();

  window.createLemonSqueezy = createLemonSqueezyMock.mockImplementation(() => {
    window.LemonSqueezy = {
      Setup: vi.fn(),
      Url: { Open: urlOpenMock },
    };
  });

  // jsdom doesn't fetch/execute the remote lemon.js script src — fire the
  // hook's script.onload handler as soon as it appends the tag.
  const originalAppendChild = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, "appendChild").mockImplementation((node: Node) => {
    const result = originalAppendChild(node);
    if (node instanceof HTMLScriptElement && node.src.includes("lemon.js")) {
      node.onload?.(new Event("load"));
    }
    return result;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as { createLemonSqueezy?: unknown }).createLemonSqueezy;
  delete (window as { LemonSqueezy?: unknown }).LemonSqueezy;
});

describe("useLemonSqueezyCheckout", () => {
  it("starts not ready, then flips ready once lemon.js loads", async () => {
    const { result } = renderHook(() => useLemonSqueezyCheckout(vi.fn()));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(createLemonSqueezyMock).toHaveBeenCalled();
  });

  it("open() calls LemonSqueezy.Url.Open and returns true once ready", async () => {
    const { result } = renderHook(() => useLemonSqueezyCheckout(vi.fn()));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let opened = false;
    act(() => {
      opened = result.current.open("https://store.lemonsqueezy.com/checkout/abc");
    });

    expect(opened).toBe(true);
    expect(urlOpenMock).toHaveBeenCalledWith("https://store.lemonsqueezy.com/checkout/abc");
  });

  it("open() returns false without calling Url.Open when the script hasn't loaded", () => {
    // Don't let appendChild's onload fire — simulate a still-loading script.
    vi.restoreAllMocks();
    delete (window as { createLemonSqueezy?: unknown }).createLemonSqueezy;
    delete (window as { LemonSqueezy?: unknown }).LemonSqueezy;

    const { result } = renderHook(() => useLemonSqueezyCheckout(vi.fn()));

    let opened = true;
    act(() => {
      opened = result.current.open("https://store.lemonsqueezy.com/checkout/abc");
    });

    expect(opened).toBe(false);
    expect(urlOpenMock).not.toHaveBeenCalled();
  });

  it("calls the onCheckoutSuccess callback on a Checkout.Success event", async () => {
    const onSuccess = vi.fn();
    renderHook(() => useLemonSqueezyCheckout(onSuccess));

    await waitFor(() => expect(window.LemonSqueezy?.Setup).toHaveBeenCalled());
    const setupMock = window.LemonSqueezy!.Setup as ReturnType<typeof vi.fn>;
    const eventHandler = setupMock.mock.calls[0][0].eventHandler;

    eventHandler({ event: "Checkout.Success" });
    expect(onSuccess).toHaveBeenCalledOnce();

    eventHandler({ event: "Checkout.Closed" });
    expect(onSuccess).toHaveBeenCalledOnce(); // still 1 — unrelated event ignored
  });

  it("uses the latest onCheckoutSuccess without re-injecting the script on every render", async () => {
    let callback = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useLemonSqueezyCheckout(cb),
      { initialProps: { cb: callback } }
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(createLemonSqueezyMock).toHaveBeenCalledTimes(1);

    const newCallback = vi.fn();
    callback = newCallback;
    rerender({ cb: newCallback });

    // Script is not re-injected on a callback identity change.
    expect(createLemonSqueezyMock).toHaveBeenCalledTimes(1);

    const setupMock = window.LemonSqueezy!.Setup as ReturnType<typeof vi.fn>;
    const eventHandler = setupMock.mock.calls[0][0].eventHandler;
    eventHandler({ event: "Checkout.Success" });
    expect(newCallback).toHaveBeenCalledOnce();
  });

  it("removes the injected script tag on unmount", async () => {
    const { unmount } = renderHook(() => useLemonSqueezyCheckout(vi.fn()));
    expect(document.querySelector('script[src*="lemon.js"]')).not.toBeNull();

    unmount();
    expect(document.querySelector('script[src*="lemon.js"]')).toBeNull();
  });
});
