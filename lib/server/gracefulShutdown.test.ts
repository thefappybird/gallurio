import { describe, expect, it, vi } from "vitest";
import { gracefulShutdown } from "./gracefulShutdown";

function makeDeps(overrides: Partial<Parameters<typeof gracefulShutdown>[0]> = {}) {
  const calls: string[] = [];
  const httpServer = {
    close: vi.fn((cb: () => void) => {
      calls.push("httpServer.close");
      cb();
    }),
  } as unknown as Parameters<typeof gracefulShutdown>[0]["httpServer"];
  const io = {
    close: vi.fn((cb: () => void) => {
      calls.push("io.close");
      cb();
    }),
  } as unknown as Parameters<typeof gracefulShutdown>[0]["io"];
  const stopWorld = vi.fn(async () => {
    calls.push("stopWorld");
  });
  const closeMongoConnection = vi.fn(async () => {
    calls.push("closeMongoConnection");
  });
  const exit = vi.fn((code: number) => {
    calls.push(`exit(${code})`);
  });

  return {
    calls,
    deps: {
      httpServer,
      io,
      stopWorld,
      closeMongoConnection,
      exit,
      ...overrides,
    },
  };
}

describe("gracefulShutdown", () => {
  it("closes the http server, io, stops the world, closes mongoose, then exits 0 in order", async () => {
    const { calls, deps } = makeDeps();
    const shutdown = gracefulShutdown(deps);
    shutdown();
    await vi.waitFor(() => expect(deps.exit).toHaveBeenCalled());

    expect(calls).toEqual([
      "httpServer.close",
      "io.close",
      "stopWorld",
      "closeMongoConnection",
      "exit(0)",
    ]);
  });

  it("force-exits(1) if a dependency close hangs past the timeout", async () => {
    vi.useFakeTimers();
    const { deps } = makeDeps({
      // Never calls the callback — simulates a hung close.
      httpServer: { close: vi.fn() } as unknown as Parameters<typeof gracefulShutdown>[0]["httpServer"],
      timeoutMs: 5_000,
    });

    const shutdown = gracefulShutdown(deps);
    shutdown();
    expect(deps.exit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(deps.exit).toHaveBeenCalledWith(1);

    vi.useRealTimers();
  });

  it("ignores a second signal while shutdown is already in flight", async () => {
    const { calls, deps } = makeDeps();
    const shutdown = gracefulShutdown(deps);
    shutdown();
    shutdown();
    await vi.waitFor(() => expect(deps.exit).toHaveBeenCalled());

    expect(deps.httpServer.close).toHaveBeenCalledOnce();
    expect(calls.filter((c) => c.startsWith("exit"))).toHaveLength(1);
  });
});
