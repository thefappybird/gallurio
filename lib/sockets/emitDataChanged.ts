import "server-only";
import type { Server } from "socket.io";
import { Types } from "mongoose";
import { DATA_CHANGED_EVENT, type DataChangedPayload, type DataEvent } from "@/lib/data-events";
import { TeamMembership, User, Workspace } from "@/lib/db/models";
import { getIO } from "./io";

type EmitOptions = {
  /**
   * Teams that may see the affected booking (old + new on reassignment).
   * Honoured only for booking.created/updated: owners and members of these
   * teams get the full event, everyone else only `client.statsChanged`.
   */
  teamIds?: Array<string | null | undefined>;
};

/** Owners (Workspace.ownerUserId or an owner membership) + members of `teamIds`. */
async function resolveBookingAudience(
  workspaceId: string,
  teamIds: Array<string | null | undefined>
): Promise<string[]> {
  const wsOid = new Types.ObjectId(workspaceId);
  const teamOids = [...new Set(teamIds.filter((t): t is string => !!t))].map((t) => new Types.ObjectId(t));
  const [workspace, ownerUsers, members] = await Promise.all([
    Workspace.findById(wsOid, { ownerUserId: 1 }).lean(),
    User.find({ memberships: { $elemMatch: { workspaceId: wsOid, role: "owner" } } }, { workosUserId: 1 }).lean(),
    teamOids.length
      ? TeamMembership.find({ workspaceId: wsOid, teamId: { $in: teamOids } }, { workosUserId: 1 }).lean()
      : Promise.resolve([]),
  ]);
  // No workspace/owner => cannot tell who may see it: throw so the caller broadcasts to all.
  if (!workspace?.ownerUserId) throw new Error("workspace owner not found");
  return [
    ...new Set([workspace.ownerUserId, ...ownerUsers.map((u) => u.workosUserId), ...members.map((m) => m.workosUserId)]),
  ];
}

async function emitTeamScoped(
  io: Server,
  workspaceId: string,
  event: Extract<DataEvent, { type: "booking.created" | "booking.updated" }>,
  payload: DataChangedPayload,
  teamIds: Array<string | null | undefined>
): Promise<void> {
  try {
    const rooms = (await resolveBookingAudience(workspaceId, teamIds)).map((u) => `user:${u}`);
    io.to(rooms).emit(DATA_CHANGED_EVENT, payload);
    const stats: DataChangedPayload = {
      workspaceId,
      event: { type: "client.statsChanged", clientId: event.clientId ?? null },
      at: payload.at,
    };
    io.to(`workspace:${workspaceId}`).except(rooms).emit(DATA_CHANGED_EVENT, stats);
  } catch (err) {
    // Fail open: when unsure who may see the booking, everyone refetches.
    console.error("[emitDataChanged] audience resolution failed, broadcasting to workspace", err);
    try {
      io.to(`workspace:${workspaceId}`).emit(DATA_CHANGED_EVENT, payload);
    } catch (err2) {
      console.error("[emitDataChanged] failed", err2);
    }
  }
}

/**
 * Broadcast a tiny "data changed" event to every socket in the workspace room.
 * Fire-and-forget: never throws, no-op outside the custom server (io unset).
 * Call AFTER the write commits, with the server-resolved workspaceId.
 * Booking events with `opts.teamIds` are team-scoped (see EmitOptions).
 */
export function emitDataChanged(workspaceId: string, event: DataEvent, opts?: EmitOptions): void {
  try {
    const io = getIO();
    if (!io) return;
    const payload: DataChangedPayload = { workspaceId, event, at: Date.now() };
    if (opts?.teamIds && (event.type === "booking.created" || event.type === "booking.updated")) {
      void emitTeamScoped(io, workspaceId, event, payload, opts.teamIds);
      return;
    }
    io.to(`workspace:${workspaceId}`).emit(DATA_CHANGED_EVENT, payload);
  } catch (err) {
    console.error("[emitDataChanged] failed", err);
  }
}
