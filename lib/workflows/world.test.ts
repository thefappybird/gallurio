import { describe, it, expect, vi, beforeEach } from "vitest";

const start = vi.fn().mockResolvedValue(undefined);
const close = vi.fn().mockResolvedValue(undefined);
const getWorld = vi.fn(() => ({ start, close }));
const healthCheck = vi.fn();

vi.mock("workflow/runtime", () => ({
  getWorld: () => getWorld(),
  healthCheck: (...args: unknown[]) => healthCheck(...args),
}));

describe("lib/workflows/world", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorld.mockReturnValue({ start, close });
  });

  it("startWorld() calls getWorld().start()", async () => {
    const { startWorld } = await import("./world");
    await startWorld();
    expect(start).toHaveBeenCalledOnce();
  });

  it("stopWorld() calls getWorld().close()", async () => {
    const { stopWorld } = await import("./world");
    await stopWorld();
    expect(close).toHaveBeenCalledOnce();
  });

  it("worldReady() returns healthy:true when healthCheck reports healthy", async () => {
    healthCheck.mockResolvedValue({ healthy: true });
    const { worldReady } = await import("./world");
    const result = await worldReady();
    expect(result).toEqual({ healthy: true, error: undefined });
  });

  it("worldReady() returns healthy:false with an error when healthCheck throws", async () => {
    healthCheck.mockRejectedValue(new Error("world unreachable"));
    const { worldReady } = await import("./world");
    const result = await worldReady();
    expect(result).toEqual({ healthy: false, error: "world unreachable" });
  });
});
