import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { usePickerData, __clearPickerDataCache } from "./usePickerData";

const MOCK_DATA = {
  collections: [{ id: "c1", name: "Wedding 2024", coverUrl: null, itemCount: 6 }],
  items: [
    {
      id: "i1",
      publicId: "cf-asset-abc123",
      thumbUrl: "https://imagedelivery.net/test-hash/cf-asset-abc123/w=200,h=200,fit=cover,q=85,f=auto",
      caption: null,
      altText: null,
    },
  ],
};

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => MOCK_DATA,
  } as unknown as Response);
});

afterEach(() => {
  __clearPickerDataCache();
});

describe("usePickerData", () => {
  it("starts in loading state then resolves to ok", async () => {
    const { result } = renderHook(() => usePickerData());
    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(result.current.state.status).toBe("ok"));
    if (result.current.state.status === "ok") {
      expect(result.current.state.data.collections).toHaveLength(1);
    }
  });

  it("serves data from cache on second mount (no re-fetch)", async () => {
    const { result: r1 } = renderHook(() => usePickerData());
    await waitFor(() => expect(r1.current.state.status).toBe("ok"));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const { result: r2 } = renderHook(() => usePickerData());
    // Cache hit: starts ok immediately, no new fetch
    expect(r2.current.state.status).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(1); // still only 1
  });

  it("retry() busts the cache and re-fetches", async () => {
    const { result } = renderHook(() => usePickerData());
    await waitFor(() => expect(result.current.state.status).toBe("ok"));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });
    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(result.current.state.status).toBe("ok"));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("reports error state when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => usePickerData());
    await waitFor(() => expect(result.current.state.status).toBe("error"));
  });

  it("reports error state when server returns non-ok HTTP status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);
    const { result } = renderHook(() => usePickerData());
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    if (result.current.state.status === "error") {
      expect(result.current.state.message).toContain("HTTP 500");
    }
  });

  it("deduplicated concurrent mounts share one in-flight fetch", async () => {
    // Both hooks mount before fetch resolves — only one network call should be issued.
    const { result: r1 } = renderHook(() => usePickerData());
    const { result: r2 } = renderHook(() => usePickerData());

    await waitFor(() => expect(r1.current.state.status).toBe("ok"));
    await waitFor(() => expect(r2.current.state.status).toBe("ok"));

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retry() after error allows a successful re-fetch", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => usePickerData());
    await waitFor(() => expect(result.current.state.status).toBe("error"));

    // mockFetch now returns success (default from beforeEach was reset, reset again)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_DATA,
    } as unknown as Response);

    act(() => {
      result.current.retry();
    });
    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(result.current.state.status).toBe("ok"));
    if (result.current.state.status === "ok") {
      expect(result.current.state.data.items).toHaveLength(1);
    }
  });

  it("returns populated collections and items shape from MOCK_DATA", async () => {
    const { result } = renderHook(() => usePickerData());
    await waitFor(() => expect(result.current.state.status).toBe("ok"));
    if (result.current.state.status === "ok") {
      const { collections, items } = result.current.state.data;
      expect(collections[0].id).toBe("c1");
      expect(items[0].publicId).toBe("cf-asset-abc123");
    }
  });

  it("unmounting while loading does not cause setState-after-unmount error", async () => {
    // Let the fetch hang so we can unmount before it resolves
    let resolveHangingFetch!: (r: Response) => void;
    mockFetch.mockReturnValueOnce(
      new Promise<Response>((res) => {
        resolveHangingFetch = res;
      })
    );

    const { result, unmount } = renderHook(() => usePickerData());
    expect(result.current.state.status).toBe("loading");
    unmount();

    // Resolve after unmount — should not throw
    resolveHangingFetch({
      ok: true,
      json: async () => MOCK_DATA,
    } as unknown as Response);

    // Give microtasks a tick to settle; no error expected
    await new Promise((r) => setTimeout(r, 20));
  });
});
