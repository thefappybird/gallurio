import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { usePickerData, useInvalidatePickerData } from "./usePickerData";
import { GalleryQueryProvider } from "./GalleryQueryProvider";

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

function wrapperFor(workspaceId: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <GalleryQueryProvider workspaceId={workspaceId}>{children}</GalleryQueryProvider>;
  };
}

// Two consumers under the SAME <GalleryQueryProvider> — one QueryClient,
// mirroring production (one mount per EditorShell, every gallery-picker
// descendant shares it). Two separate renderHook() calls would each get
// their OWN QueryClient, which can't exercise cross-instance sharing.
function TwoPickerInstances({ workspaceId }: { workspaceId: string }) {
  return (
    <GalleryQueryProvider workspaceId={workspaceId}>
      <Probe testId="a" />
      <Probe testId="b" />
    </GalleryQueryProvider>
  );
}

function Probe({ testId }: { testId: string }) {
  const { state } = usePickerData();
  return (
    <span data-testid={`${testId}-status`}>
      {state.status}
      {state.status === "ok" ? `:${state.data.collections.length}` : ""}
    </span>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => MOCK_DATA,
  } as unknown as Response);
});

describe("usePickerData", () => {
  it("starts in loading state then resolves to ok", async () => {
    const { result } = renderHook(() => usePickerData(), { wrapper: wrapperFor("ws-1") });
    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(result.current.state.status).toBe("ok"));
    if (result.current.state.status === "ok") {
      expect(result.current.state.data.collections).toHaveLength(1);
    }
  });

  it("deduplicated concurrent mounts within the same workspace share one in-flight fetch", async () => {
    render(<TwoPickerInstances workspaceId="ws-1" />);
    await waitFor(() => expect(screen.getByTestId("a-status").textContent).toBe("ok:1"));
    await waitFor(() => expect(screen.getByTestId("b-status").textContent).toBe("ok:1"));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("reports error state when fetch fails (even after the configured retry)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => usePickerData(), { wrapper: wrapperFor("ws-1") });
    await waitFor(() => expect(result.current.state.status).toBe("error"), { timeout: 3000 });
  });

  it("reports error state when server returns non-ok HTTP status (even after the configured retry)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);
    const { result } = renderHook(() => usePickerData(), { wrapper: wrapperFor("ws-1") });
    await waitFor(() => expect(result.current.state.status).toBe("error"), { timeout: 3000 });
    if (result.current.state.status === "error") {
      expect(result.current.state.message).toContain("HTTP 500");
    }
  });

  it("retry() busts the cache and re-fetches", async () => {
    const { result } = renderHook(() => usePickerData(), { wrapper: wrapperFor("ws-1") });
    await waitFor(() => expect(result.current.state.status).toBe("ok"));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.state.status).toBe("ok"));
  });

  it("invalidating from useInvalidatePickerData() reaches every mounted instance, not just the caller", async () => {
    function Invalidator() {
      const invalidate = useInvalidatePickerData();
      return (
        <button type="button" onClick={invalidate}>
          invalidate
        </button>
      );
    }
    function Harness() {
      return (
        <GalleryQueryProvider workspaceId="ws-1">
          <Probe testId="a" />
          <Probe testId="b" />
          <Invalidator />
        </GalleryQueryProvider>
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("a-status").textContent).toBe("ok:1"));
    await waitFor(() => expect(screen.getByTestId("b-status").textContent).toBe("ok:1"));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const UPDATED_DATA = {
      collections: [
        { id: "c1", name: "Wedding 2024", coverUrl: null, itemCount: 6 },
        { id: "c2", name: "New Collection", coverUrl: null, itemCount: 0 },
      ],
      items: MOCK_DATA.items,
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => UPDATED_DATA } as unknown as Response);

    fireEvent.click(screen.getByRole("button", { name: "invalidate" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    // Both mounted instances observe the refreshed data, not just the caller.
    await waitFor(() => expect(screen.getByTestId("a-status").textContent).toBe("ok:2"));
    await waitFor(() => expect(screen.getByTestId("b-status").textContent).toBe("ok:2"));
  });

  it("a workspace switch within the SAME mounted QueryClient never serves the prior tenant's cache", async () => {
    // Simulates the real risk: one long-lived GalleryQueryProvider (its
    // QueryClient persists) whose `workspaceId` prop changes underneath it —
    // the query key must still isolate per workspace, not reuse workspace A's
    // cached collections for workspace B.
    function Harness() {
      const [workspaceId, setWorkspaceId] = useState("ws-a");
      return (
        <GalleryQueryProvider workspaceId={workspaceId}>
          <button onClick={() => setWorkspaceId("ws-b")}>switch workspace</button>
          <Probe testId="status" />
        </GalleryQueryProvider>
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status-status").textContent).toBe("ok:1"));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "switch workspace" }));
    // Distinct workspaceId -> distinct query key -> a fresh fetch, never a
    // cache hit borrowed from workspace A's entry in the same QueryClient.
    expect(screen.getByTestId("status-status").textContent).toBe("loading");
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("status-status").textContent).toBe("ok:1"));
  });
});
