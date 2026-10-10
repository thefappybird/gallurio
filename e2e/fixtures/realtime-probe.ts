import mongoose from "mongoose";
import { io, type Socket } from "socket.io-client";
import { signSocketToken } from "../../lib/sockets/auth";

// Node-side helpers for the data-integrity spec: read the seeded workspace's
// team layout straight from the dev DB and listen on the realtime socket as a
// staff member (no staff login exists, so the socket token is minted with the
// same HMAC secret the server uses).

type Payload = { workspaceId: string; event: { type: string } & Record<string, unknown> };

export async function connectDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set in .env.local");
  await mongoose.connect(url);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

const col = (name: string) => mongoose.connection.db!.collection(name);

/** Owner's active workspace + a booking whose team has a non-owner member, and a staff member outside that team. */
export async function findStaffScenario(ownerWorkosUserId: string) {
  const owner = await col("users").findOne({ workosUserId: ownerWorkosUserId });
  if (!owner) throw new Error("seed owner not found");
  const workspace = await col("workspaces").findOne({ ownerUserId: ownerWorkosUserId });
  if (!workspace) throw new Error("seed workspace not found");
  const workspaceId = workspace._id;

  const memberships = await col("teammemberships")
    .find({ workspaceId, workosUserId: { $ne: ownerWorkosUserId } })
    .toArray();
  const teamsByUser = new Map<string, Set<string>>();
  for (const m of memberships) {
    const set = teamsByUser.get(m.workosUserId) ?? new Set<string>();
    set.add(String(m.teamId));
    teamsByUser.set(m.workosUserId, set);
  }

  for (const m of memberships) {
    const teamId = String(m.teamId);
    const outsider = [...teamsByUser.entries()].find(([, teams]) => !teams.has(teamId))?.[0];
    if (!outsider) continue;
    const booking = await col("bookings").findOne({ workspaceId, teamId: m.teamId, status: { $ne: "draft" } });
    if (!booking) continue;
    return {
      workspaceId: String(workspaceId),
      bookingId: String(booking._id),
      teamId,
      insider: m.workosUserId as string,
      outsider,
    };
  }
  return null;
}

export type Probe = { events: Payload[]; socket: Socket; close: () => void };

/** Connect as `workosUserId` in `workspaceId` and record every data:changed payload. */
export async function listenAs(baseURL: string, workosUserId: string, workspaceId: string): Promise<Probe> {
  const socket = io(baseURL, {
    auth: { token: signSocketToken(workosUserId, workspaceId) },
    transports: ["websocket"],
    reconnection: false,
  });
  const events: Payload[] = [];
  socket.on("data:changed", (p: Payload) => events.push(p));
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
  return { events, socket, close: () => socket.close() };
}
