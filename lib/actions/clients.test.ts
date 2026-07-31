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
  it("valid input creates client and returns { ok: true }", async () => {
    mockOrg();

    const result = await createClientAction(validInput);

    expect(result).toEqual({ ok: true });
    const saved = await Client.findOne({ workspaceId, name: "Alice Wonderland" }).lean();
    expect(saved).not.toBeNull();
    expect(saved?.email).toBe("alice@example.com");
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
});
