import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import { setIO } from "./io";
import { emitDataChanged } from "./emitDataChanged";

afterEach(() => {
  global.__io = undefined;
  vi.restoreAllMocks();
});

describe("emitDataChanged", () => {
  it("emits data:changed to the workspace room with type-only payload", () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    setIO({ to } as unknown as Server);

    emitDataChanged("ws1", { type: "booking.created", bookingId: "b1" });

    expect(to).toHaveBeenCalledWith("workspace:ws1");
    expect(emit).toHaveBeenCalledWith("data:changed", {
      workspaceId: "ws1",
      event: { type: "booking.created", bookingId: "b1" },
      at: expect.any(Number),
    });
  });

  it("catches and logs a throwing io", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    setIO({
      to: () => {
        throw new Error("boom");
      },
    } as unknown as Server);

    expect(() => emitDataChanged("ws1", { type: "workspace.updated" })).not.toThrow();
    expect(err).toHaveBeenCalled();
  });

  it("is a no-op when io is undefined", () => {
    expect(() => emitDataChanged("ws1", { type: "workspace.updated" })).not.toThrow();
  });
});
