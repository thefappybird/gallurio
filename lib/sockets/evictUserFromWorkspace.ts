import "server-only";
import { getIO } from "./io";

/**
 * Disconnect a removed member's sockets from the workspace room so they stop
 * receiving `data:changed` (the room is joined once at connect). The client
 * reconnects with a fresh token, which re-validates membership.
 * Never throws; no-op outside the custom server (io unset). Call AFTER the
 * membership removal commits.
 */
export async function evictUserFromWorkspace(
  workspaceId: string,
  workosUserId: string,
): Promise<void> {
  try {
    const sockets = await getIO()?.in(`workspace:${workspaceId}`).fetchSockets();
    for (const s of sockets ?? []) {
      if (s.data?.workosUserId === workosUserId) s.disconnect(true);
    }
  } catch (err) {
    console.error("[evictUserFromWorkspace] failed", err);
  }
}
