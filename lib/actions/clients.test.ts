import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Client, Booking } from "@/lib/db/models";
import type { WorkspaceDoc } from "@/lib/db/models";
import { requireOrg } from "@/lib/auth/requireOrg";
import type { OrgContext } from "@/lib/auth/requireOrg";
import {
  createClientAction,
  updateClientAction,
  deactivateClientAction,
  reactivateClientAction,
  getClientBookingsAction,
  findClientMatchesAction,
} from "./clients";

vi.mock("@/lib/auth/requireOrg", () => ({ requireOrg: vi.fn(), requireRole: vi.fn() }));
const emit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sockets/emitDataChanged", () => ({ emitDataChanged: emit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();

function mockOrg(wsId: Types.ObjectId = workspaceId) {
  // Only the workspace._id field is read by the actions under test; cast
  // through unknown to a typed WorkspaceDoc to avoid building the full doc.
  const workspace = { _id: wsId } as unknown as WorkspaceDoc;
  const ctx: OrgContext = {
    userId: "user_test",
    workspaceId: wsId.toString(),
    role: "owner",
    workspace,
    userAvatarUrl: null,
  };
  vi.mocked(requireOrg).mockResolvedValue(ctx);
}

const validInput = {
  name: "Alice Wonderland",
  email: "alice@example.com",
  phone: "+1 415 555 0142",
  source: "manual" as const,
  tags: ["VIP"],
  notes: "Test notes",
};

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
  vi.resetAllMocks();
});

// ─── createClientAction ───────────────────────────────────────────────────────

describe("createClientAction", () => {
  it("valid input creates client and returns { ok: true, clientId }", async () => {
    mockOrg();

    const result = await createClientAction(validInput);

    const saved = await Client.findOne({ workspaceId, name: "Alice Wonderland" }).lean();
    expect(result).toEqual({ ok: true, clientId: String(saved?._id) });
    expect(saved).not.toBeNull();
    expect(saved?.email).toBe("alice@example.com");
  });

  it("emits client.created with the session workspace after create, none on invalid input", async () => {
    mockOrg();
    await createClientAction({ ...validInput, name: "" });
    expect(emit).not.toHaveBeenCalled();
    await createClientAction(validInput);
    const saved = await Client.findOne({ workspaceId, name: "Alice Wonderland" }).lean();
    expect(emit).toHaveBeenCalledWith(String(workspaceId), {
      type: "client.created",
      clientId: String(saved?._id),
    });
  });

  it("missing name returns validation error", async () => {
    mockOrg();

    const result = await createClientAction({ ...validInput, name: "" });

    expect(result).toEqual({ error: "invalid_input" });
    const count = await Client.countDocuments({ workspaceId });
    expect(count).toBe(0);
  });

  it("requireOrg failure returns error", async () => {
    vi.mocked(requireOrg).mockRejectedValue(new Error("Not authenticated"));

    const result = await createClientAction(validInput);

    expect(result).toEqual({ error: "client_create_failed" });
  });
});

// ─── updateClientAction ───────────────────────────────────────────────────────

describe("updateClientAction", () => {
  it("valid input updates client and returns { ok: true }", async () => {
    mockOrg();
    const client = await Client.create({
      workspaceId,
      name: "Original Name",
      source: "manual",
      tags: [],
      notes: "",
    });

    const result = await updateClientAction(client._id.toString(), {
      ...validInput,
      name: "Updated Name",
    });

    expect(result).toEqual({ ok: true });
    const updated = await Client.findById(client._id).lean();
    expect(updated?.name).toBe("Updated Name");
  });

  it("emits client.updated after update, none for a foreign client", async () => {
    mockOrg();
    const foreign = await Client.create({ workspaceId: otherWorkspaceId, name: "F", source: "manual", tags: [], notes: "" });
    await updateClientAction(foreign._id.toString(), validInput);
    expect(emit).not.toHaveBeenCalled();
    const own = await Client.create({ workspaceId, name: "O", source: "manual", tags: [], notes: "" });
    await updateClientAction(own._id.toString(), validInput);
    expect(emit).toHaveBeenCalledWith(String(workspaceId), { type: "client.updated", clientId: String(own._id) });
  });

  it("wrong workspaceId (cross-workspace) returns { error: 'client_not_found' }", async () => {
    // Client belongs to otherWorkspaceId but action uses workspaceId
    const client = await Client.create({
      workspaceId: otherWorkspaceId,
      name: "Other Workspace Client",
      source: "manual",
      tags: [],
      notes: "",
    });
    mockOrg(workspaceId);

    const result = await updateClientAction(client._id.toString(), validInput);

    expect(result).toEqual({ error: "client_not_found" });
  });

  it("missing name fails validation", async () => {
    mockOrg();
    const client = await Client.create({
      workspaceId,
      name: "Existing Client",
      source: "manual",
      tags: [],
      notes: "",
    });

    const result = await updateClientAction(client._id.toString(), {
      ...validInput,
      name: "",
    });

    expect(result).toEqual({ error: "invalid_input" });
  });
});

// ─── deactivateClientAction ───────────────────────────────────────────────────

describe("deactivateClientAction", () => {
  it("sets isActive: false and returns { ok: true }", async () => {
    mockOrg();
    const client = await Client.create({
      workspaceId,
      name: "Active Client",
      source: "manual",
      tags: [],
      notes: "",
      isActive: true,
    });

    const result = await deactivateClientAction(client._id.toString());

    expect(result).toEqual({ ok: true });
    const updated = await Client.findById(client._id).lean();
    expect(updated?.isActive).toBe(false);
  });

  it("emits client.updated after (de/re)activation, none for a foreign client", async () => {
    mockOrg();
    const foreign = await Client.create({ workspaceId: otherWorkspaceId, name: "F", source: "manual", tags: [], notes: "" });
    await deactivateClientAction(foreign._id.toString());
    await reactivateClientAction(foreign._id.toString());
    expect(emit).not.toHaveBeenCalled();
    const own = await Client.create({ workspaceId, name: "O", source: "manual", tags: [], notes: "" });
    await deactivateClientAction(own._id.toString());
    await reactivateClientAction(own._id.toString());
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith(String(workspaceId), { type: "client.updated", clientId: String(own._id) });
  });

  it("wrong workspaceId returns { error: 'client_not_found' }", async () => {
    const client = await Client.create({
      workspaceId: otherWorkspaceId,
      name: "Other WS Client",
      source: "manual",
      tags: [],
      notes: "",
    });
    mockOrg(workspaceId);

    const result = await deactivateClientAction(client._id.toString());

    expect(result).toEqual({ error: "client_not_found" });
  });
});

// ─── reactivateClientAction ───────────────────────────────────────────────────

describe("reactivateClientAction", () => {
  it("sets isActive: true on previously deactivated client", async () => {
    mockOrg();
    const client = await Client.create({
      workspaceId,
      name: "Inactive Client",
      source: "manual",
      tags: [],
      notes: "",
      isActive: false,
    });

    const result = await reactivateClientAction(client._id.toString());

    expect(result).toEqual({ ok: true });
    const updated = await Client.findById(client._id).lean();
    expect(updated?.isActive).toBe(true);
  });

  it("wrong workspaceId returns { error: 'client_not_found' }", async () => {
    const client = await Client.create({
      workspaceId: otherWorkspaceId,
      name: "Other WS Client",
      source: "manual",
      tags: [],
      notes: "",
      isActive: false,
    });
    mockOrg(workspaceId);

    const result = await reactivateClientAction(client._id.toString());

    expect(result).toEqual({ error: "client_not_found" });
  });
});

// ─── getClientBookingsAction ──────────────────────────────────────────────────

describe("getClientBookingsAction", () => {
  async function seedBooking(wid: Types.ObjectId, cid: Types.ObjectId, title = "Test Booking") {
    const start = new Date("2024-03-15T10:00:00Z");
    const end = new Date("2024-03-15T12:00:00Z");
    return Booking.create({
      workspaceId: wid,
      teamId: new Types.ObjectId(),
      clientId: cid,
      clientName: "Test Client",
      title,
      status: "booked",
      sessions: [{ startAt: start, endAt: end }],
      firstSessionStart: start,
      lastSessionEnd: end,
      amount: { total: 5000, deposit: 0, currency: "PHP" },
    });
  }

  it("returns booking rows for correct workspace", async () => {
    mockOrg();
    const clientId = new Types.ObjectId();
    await seedBooking(workspaceId, clientId, "My Event");

    const result = await getClientBookingsAction(clientId.toString());

    expect(Array.isArray(result)).toBe(true);
    const rows = result as { title: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("My Event");
  });

  it("cross-workspace query returns empty array (workspace isolation)", async () => {
    // Action uses workspaceId but booking belongs to otherWorkspaceId
    mockOrg(workspaceId);
    const clientId = new Types.ObjectId();
    await seedBooking(otherWorkspaceId, clientId, "Other WS Event");

    const result = await getClientBookingsAction(clientId.toString());

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

describe("findClientMatchesAction", () => {
  it("returns same-name clients from this workspace only, and never another tenant's", async () => {
    mockOrg(workspaceId);
    await Client.create([
      { workspaceId, name: "Ana Cruz", email: "ana@example.com", source: "manual" },
      { workspaceId, name: "Bea Santos", email: "bea@example.com", source: "manual" },
      // Same name, different tenant — must never surface.
      { workspaceId: otherWorkspaceId, name: "Ana Cruz", source: "manual" },
    ]);

    const result = await findClientMatchesAction({ name: "cruz, ana", email: null, phone: null });

    expect("matches" in result).toBe(true);
    if (!("matches" in result)) return;
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].name).toBe("Ana Cruz");
    // Serializable across the Server Action boundary.
    expect(typeof result.matches[0].id).toBe("string");
  });

  it("carries source so linking cannot relabel the client's provenance", async () => {
    // The add form defaults source to "manual" and updateClientAction $sets the
    // whole document, so an unprojected source silently rewrites it.
    mockOrg(workspaceId);
    await Client.create({ workspaceId, name: "Ana Cruz", source: "referral" });

    const result = await findClientMatchesAction({ name: "Ana Cruz", email: null, phone: null });

    if (!("matches" in result)) throw new Error("expected matches");
    expect(result.matches[0].source).toBe("referral");
  });
});

describe("updateClientAction name propagation", () => {
  async function seedBookingFor(wid: Types.ObjectId, clientId: Types.ObjectId, clientName: string) {
    const at = new Date("2026-08-15T10:00:00Z");
    return Booking.create({
      workspaceId: wid,
      teamId: new Types.ObjectId(),
      clientId,
      clientName,
      title: "Shoot",
      status: "booked",
      sessions: [{ startAt: at, endAt: at }],
      firstSessionStart: at,
      lastSessionEnd: at,
      amount: { total: 100, deposit: 0, currency: "PHP" },
    });
  }

  it("renames denormalized Booking.clientName for that client only, within the workspace", async () => {
    mockOrg();
    const client = await Client.create({ workspaceId, name: "Old Name", source: "manual" });
    const sameIdOtherWs = await seedBookingFor(otherWorkspaceId, client._id, "Old Name");
    const mine = await seedBookingFor(workspaceId, client._id, "Old Name");
    const otherClient = await Client.create({ workspaceId, name: "Bob", source: "manual" });
    const bobs = await seedBookingFor(workspaceId, otherClient._id, "Bob");

    const result = await updateClientAction(String(client._id), { ...validInput, name: "New Name" });

    expect(result).toEqual({ ok: true });
    expect((await Booking.findById(mine._id).lean())?.clientName).toBe("New Name");
    expect((await Booking.findById(bobs._id).lean())?.clientName).toBe("Bob");
    expect((await Booking.findById(sameIdOtherWs._id).lean())?.clientName).toBe("Old Name");
    expect(emit).toHaveBeenCalledWith(String(workspaceId), { type: "client.updated", clientId: String(client._id) });
  });
});
