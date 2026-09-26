import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { GalleryQueryProvider, useGalleryWorkspaceId } from "./GalleryQueryProvider";

function Consumer() {
  const workspaceId = useGalleryWorkspaceId();
  const queryClient = useQueryClient();
  return <span data-testid="out">{workspaceId}:{queryClient ? "has-client" : "no-client"}</span>;
}

describe("GalleryQueryProvider", () => {
  it("provides the workspaceId and a QueryClient to descendants", () => {
    render(
      <GalleryQueryProvider workspaceId="ws-1">
        <Consumer />
      </GalleryQueryProvider>
    );
    expect(screen.getByTestId("out").textContent).toBe("ws-1:has-client");
  });

  it("useGalleryWorkspaceId throws outside a GalleryQueryProvider", () => {
    function Bare() {
      useGalleryWorkspaceId();
      return null;
    }
    expect(() => render(<Bare />)).toThrow();
  });
});
