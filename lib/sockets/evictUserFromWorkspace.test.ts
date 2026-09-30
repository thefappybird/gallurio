import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import { setIO } from "./io";
import { evictUserFromWorkspace } from "./evictUserFromWorkspace";

afterEach(() => {
  global.__io = undefined;
  vi.restoreAllMocks();
});

function fakeSocket(workosUserId: string) {
  return { data: { workosUserId }, disconnect: vi.fn() };
}

describe("evictUserFromWorkspace", () => {
  it("disconnects only the removed user's sockets in the workspace room", async () => {
    const target = fakeSocket("u_removed");
    const other = fakeSocket("u_other");
    const inRoom = vi.fn(() => ({ fetchSockets: async () => [target, other] }));
    setIO({ in: inRoom } as unknown as Server);

    await evictUserFromWorkspace("ws1", "u_removed");

    expect(inRoom).toHaveBeenCalledWith("workspace:ws1");
    expect(target.disconnect).toHaveBeenCalledWith(true);
    expect(other.disconnect).not.toHaveBeenCalled();
  });

  it("never throws when io rejects", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    setIO({
      in: () => ({
        fetchSockets: async () => {
          throw new Error("boom");
        },
      }),
    } as unknown as Server);

    await expect(evictUserFromWorkspace("ws1", "u1")).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
  });

  it("is a no-op when io is undefined", async () => {
    await expect(evictUserFromWorkspace("ws1", "u1")).resolves.toBeUndefined();
  });
});
