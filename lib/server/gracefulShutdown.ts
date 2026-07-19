import type { Server as HttpServer } from "http";
import type { Server as SocketIOServer } from "socket.io";

// This dependency-injected helper is shared with the raw `tsx server.ts`
// entrypoint and therefore cannot use Next's `server-only` marker.

export type GracefulShutdownDeps = {
  httpServer: Pick<HttpServer, "close">;
  io: Pick<SocketIOServer, "close">;
  closeMongoConnection: () => Promise<void>;
  exit: (code: number) => void;
  /** Hard ceiling so a hung close still exits. Default 10s. */
  timeoutMs?: number;
};

// Builds a SIGTERM/SIGINT handler: stop accepting new connections, close
// Socket.IO, close the Mongo connection, then exit. Bounded by a timeout so a
// hung dependency close can't wedge the process (PM2 restarts/reboots would
// otherwise hang past their grace period).
export function gracefulShutdown(deps: GracefulShutdownDeps): () => void {
  let shuttingDown = false;

  return () => {
    if (shuttingDown) return;
    shuttingDown = true;

    const timeoutMs = deps.timeoutMs ?? 10_000;
    const timeout = setTimeout(() => {
      console.error("[shutdown] timed out — forcing exit");
      deps.exit(1);
    }, timeoutMs);
    timeout.unref?.();

    void (async () => {
      try {
        await new Promise<void>((resolve) => deps.httpServer.close(() => resolve()));
        await new Promise<void>((resolve) => deps.io.close(() => resolve()));
        await deps.closeMongoConnection();
      } catch (err) {
        console.error("[shutdown] error during graceful shutdown:", err);
      } finally {
        clearTimeout(timeout);
        deps.exit(0);
      }
    })();
  };
}
