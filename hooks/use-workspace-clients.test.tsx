import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppQueryProvider } from "@/components/app/app-query-provider";
import { useWorkspaceClients } from "./use-workspace-clients";

const CLIENTS = [{ id: "c1", name: "Alice", email: "a@x.com", phone: null }];

function wrapper({ children }: { children: ReactNode }) {
  return <AppQueryProvider workspaceId="ws-1">{children}</AppQueryProvider>;
}

afterEach(() => vi.unstubAllGlobals());

describe("useWorkspaceClients", () => {
  it("does not request /api/clients until enabled", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => CLIENTS }));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ enabled }) => useWorkspaceClients({ enabled }), {
      wrapper,
      initialProps: { enabled: false },
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).toEqual(CLIENTS));
    expect(fetchMock).toHaveBeenCalledWith("/api/clients?limit=1000");
  });
});
