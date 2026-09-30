import "server-only";
import { DATA_CHANGED_EVENT, type DataChangedPayload, type DataEvent } from "@/lib/data-events";
import { getIO } from "./io";

/**
 * Broadcast a tiny "data changed" event to every socket in the workspace room.
 * Fire-and-forget: never throws, no-op outside the custom server (io unset).
 * Call AFTER the write commits, with the server-resolved workspaceId.
 */
export function emitDataChanged(workspaceId: string, event: DataEvent): void {
  try {
    const payload: DataChangedPayload = { workspaceId, event, at: Date.now() };
    getIO()?.to(`workspace:${workspaceId}`).emit(DATA_CHANGED_EVENT, payload);
  } catch (err) {
    console.error("[emitDataChanged] failed", err);
  }
}
