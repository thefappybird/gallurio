import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { AppQueryProvider, useAppWorkspaceId } from "./app-query-provider";

function Probe({ id, set }: { id: string; set?: boolean }) {
  const qc = useQueryClient();
  if (set) qc.setQueryData(["ws", "A", "x"], 1);
  return <span data-testid={id}>{String(qc.getQueryData(["ws", "A", "x"]))}</span>;
}

function Ws() {
  return <span>{useAppWorkspaceId()}</span>;
}

describe("AppQueryProvider", () => {
  it("does not share cache between providers", () => {
    render(
      <>
        <AppQueryProvider workspaceId="A">
          <Probe id="a" set />
        </AppQueryProvider>
        <AppQueryProvider workspaceId="B">
          <Probe id="b" />
        </AppQueryProvider>
      </>,
    );
    expect(screen.getByTestId("a").textContent).toBe("1");
    expect(screen.getByTestId("b").textContent).toBe("undefined");
  });

  it("exposes workspaceId and throws outside the provider", () => {
    render(
      <AppQueryProvider workspaceId="A">
        <Ws />
      </AppQueryProvider>,
    );
    expect(screen.getByText("A")).toBeTruthy();
    expect(() => render(<Ws />)).toThrow(/AppQueryProvider/);
  });
});
