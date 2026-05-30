import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Client, Booking } from "@/lib/db/models";
import { listClients, getWorkspaceTags, getClientBookings } from "./clients-queries";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedClient(
  wid: Types.ObjectId,
  overrides: Partial<{
    name: string;
    email: string;
    source: string;
    tags: string[];
    isActive: boolean;
  }> = {}
) {
  return Client.create({
    workspaceId: wid,
    name: overrides.name ?? "Test Client",
    email: overrides.email ?? null,
    source: overrides.source ?? "manual",
    tags: overrides.tags ?? [],
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
  });
}

async function seedBooking(
  wid: Types.ObjectId,
  cid: Types.ObjectId,
  overrides: Partial<{
    title: string;
    status: string;
    startAt: Date;
    total: number;
    currency: string;
  }> = {}
) {
  const start = overrides.startAt ?? new Date();
  const end = new Date(start.getTime() + 3_600_000);
  return Booking.create({
    workspaceId: wid,
    clientId: cid,
    clientName: "Test Client",
    title: overrides.title ?? "Test Booking",
    status: overrides.status ?? "booked",
    sessions: [{ startAt: start, endAt: end }],
    firstSessionStart: start,
    lastSessionEnd: end,
    amount: {
      total: overrides.total ?? 5000,
      deposit: 0,
      currency: overrides.currency ?? "PHP",
    },
  });
}

// ─── listClients ──────────────────────────────────────────────────────────────

describe("listClients", () => {
  it("default: returns only active clients", async () => {
    await seedClient(workspaceId, { name: "Alice", isActive: true });
    await seedClient(workspaceId, { name: "Bob", isActive: false });

    const { items, total } = await listClients({ workspaceId });

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Alice");
    expect(total).toBe(1);
  });

  it("default: includes legacy clients that pre-date the isActive field", async () => {
    // Simulate a doc inserted before `isActive` existed — drop the field
    // directly via the raw collection so the schema default doesn't fill it.
    await Client.collection.insertOne({
      workspaceId,
      name: "Legacy Client",
      source: "manual",
      tags: [],
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await seedClient(workspaceId, { name: "Modern Client", isActive: true });

    const { items, total } = await listClients({ workspaceId });

    const names = items.map((c) => c.name).sort();
    expect(names).toEqual(["Legacy Client", "Modern Client"]);
    expect(total).toBe(2);
  });

  it("default + search: legacy clients still appear when name matches", async () => {
    await Client.collection.insertOne({
      workspaceId,
      name: "Legacy Alice",
      source: "manual",
      tags: [],
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await seedClient(workspaceId, { name: "Modern Bob", isActive: true });

    const { items } = await listClients({ workspaceId, q: "alice" });

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Legacy Alice");
  });

  it("searches by name (case-insensitive)", async () => {
    await seedClient(workspaceId, { name: "Alice Wonderland" });
    await seedClient(workspaceId, { name: "Bob Smith" });

    const { items } = await listClients({ workspaceId, q: "alice" });

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Alice Wonderland");
  });

  it("searches by email (case-insensitive)", async () => {
    await seedClient(workspaceId, { name: "Alice", email: "alice@example.com" });
    await seedClient(workspaceId, { name: "Bob", email: "bob@example.com" });

    const { items } = await listClients({ workspaceId, q: "ALICE" });

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Alice");
  });

  it("source filter matches exactly", async () => {
    await seedClient(workspaceId, { name: "Via Form", source: "form" });
    await seedClient(workspaceId, { name: "Manual Entry", source: "manual" });

    const { items } = await listClients({ workspaceId, source: "form" });

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Via Form");
  });

  it("tags filter uses $all — client must have ALL listed tags", async () => {
    await seedClient(workspaceId, { name: "A", tags: ["wedding", "outdoor"] });
    await seedClient(workspaceId, { name: "B", tags: ["wedding"] });
    await seedClient(workspaceId, { name: "C", tags: ["outdoor"] });

    const { items } = await listClients({ workspaceId, tags: ["wedding", "outdoor"] });

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("A");
  });

  it("includeInactive: true returns both active and inactive clients", async () => {
    await seedClient(workspaceId, { name: "Active", isActive: true });
    await seedClient(workspaceId, { name: "Inactive", isActive: false });

    const { items, total } = await listClients({ workspaceId, includeInactive: true });

    expect(items).toHaveLength(2);
    expect(total).toBe(2);
  });

  it("pagination: page 2 with limit=2 skips first 2 results", async () => {
    // Create 4 clients with predictable names for sorting (sorted by name: 1)
    await seedClient(workspaceId, { name: "Client A" });
    await seedClient(workspaceId, { name: "Client B" });
    await seedClient(workspaceId, { name: "Client C" });
    await seedClient(workspaceId, { name: "Client D" });

    const { items, total } = await listClients({ workspaceId, page: 2, limit: 2 });

    expect(total).toBe(4);
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe("Client C");
    expect(items[1].name).toBe("Client D");
  });

  it("workspace isolation: org A cannot see org B's clients", async () => {
    await seedClient(otherWorkspaceId, { name: "Other Org Client" });

    const { items, total } = await listClients({ workspaceId });

    expect(items).toHaveLength(0);
    expect(total).toBe(0);
  });

  it("does not count draft bookings in a client's derived bookingsCount", async () => {
    const client = await seedClient(workspaceId, { name: "Drafty" });
    await seedBooking(workspaceId, client._id, { status: "booked" });
    await seedBooking(workspaceId, client._id, { status: "draft" });

    const { items } = await listClients({ workspaceId });
    const row = items.find((c) => c.name === "Drafty");
    expect(row?.bookingsCount).toBe(1);
  });

  it("total reflects entire result set, not just current page", async () => {
    await seedClient(workspaceId, { name: "Client A" });
    await seedClient(workspaceId, { name: "Client B" });
    await seedClient(workspaceId, { name: "Client C" });

    const { items, total } = await listClients({ workspaceId, page: 1, limit: 1 });

    expect(items).toHaveLength(1);
    expect(total).toBe(3);
  });
});

// ─── getWorkspaceTags ─────────────────────────────────────────────────────────

describe("getWorkspaceTags", () => {
  it("returns distinct tags from active clients only", async () => {
    await seedClient(workspaceId, { tags: ["wedding"], isActive: true });
    await seedClient(workspaceId, { tags: ["corporate"], isActive: false });

    const tags = await getWorkspaceTags(workspaceId);

    expect(tags).toContain("wedding");
    expect(tags).not.toContain("corporate");
  });

  it("includes tags from legacy clients missing the isActive field", async () => {
    await Client.collection.insertOne({
      workspaceId,
      name: "Legacy",
      source: "manual",
      tags: ["heritage"],
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const tags = await getWorkspaceTags(workspaceId);

    expect(tags).toContain("heritage");
  });

  it("returns only tags belonging to the given workspace", async () => {
    await seedClient(workspaceId, { tags: ["myTag"] });
    await seedClient(otherWorkspaceId, { tags: ["otherTag"] });

    const tags = await getWorkspaceTags(workspaceId);

    expect(tags).toContain("myTag");
    expect(tags).not.toContain("otherTag");
  });

  it("returns sorted list", async () => {
    await seedClient(workspaceId, { tags: ["zebra", "apple", "mango"] });

    const tags = await getWorkspaceTags(workspaceId);

    expect(tags).toEqual([...tags].sort());
  });

  it("deduplicates (distinct) across multiple clients", async () => {
    await seedClient(workspaceId, { tags: ["wedding", "outdoor"] });
    await seedClient(workspaceId, { tags: ["wedding", "indoor"] });

    const tags = await getWorkspaceTags(workspaceId);

    const weddingOccurrences = tags.filter((t) => t === "wedding").length;
    expect(weddingOccurrences).toBe(1);
  });
});

// ─── getClientBookings ────────────────────────────────────────────────────────

describe("getClientBookings", () => {
  it("returns bookings for correct workspace and client", async () => {
    const clientId = new Types.ObjectId();
    await seedBooking(workspaceId, clientId, { title: "My Booking" });

    const rows = await getClientBookings(workspaceId, clientId);

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("My Booking");
  });

  it("rejects cross-workspace access — returns empty, not error", async () => {
    const clientId = new Types.ObjectId();
    await seedBooking(otherWorkspaceId, clientId, { title: "Other WS Booking" });

    const rows = await getClientBookings(workspaceId, clientId);

    expect(rows).toHaveLength(0);
  });

  it("excludes draft bookings from a client's history", async () => {
    const clientId = new Types.ObjectId();
    await seedBooking(workspaceId, clientId, { title: "Confirmed", status: "booked" });
    await seedBooking(workspaceId, clientId, { title: "Draft from inquiry", status: "draft" });

    const rows = await getClientBookings(workspaceId, clientId);

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Confirmed");
  });

  it("sorts by firstSessionStart descending", async () => {
    const clientId = new Types.ObjectId();
    const early = new Date("2024-01-01T09:00:00Z");
    const late = new Date("2024-06-01T09:00:00Z");

    await seedBooking(workspaceId, clientId, { startAt: early, title: "Early" });
    await seedBooking(workspaceId, clientId, { startAt: late, title: "Late" });

    const rows = await getClientBookings(workspaceId, clientId);

    expect(rows[0].title).toBe("Late");
    expect(rows[1].title).toBe("Early");
  });

  it("is limited to 50 results", async () => {
    const clientId = new Types.ObjectId();
    const bookings = Array.from({ length: 55 }, (_, i) => {
      const start = new Date(2024, 0, i + 1, 9);
      const end = new Date(2024, 0, i + 1, 10);
      return {
        workspaceId,
        clientId,
        clientName: "Test Client",
        title: `Booking ${i}`,
        status: "booked",
        sessions: [{ startAt: start, endAt: end }],
        firstSessionStart: start,
        lastSessionEnd: end,
        amount: { total: 1000, deposit: 0, currency: "PHP" },
      };
    });
    await Booking.insertMany(bookings);

    const rows = await getClientBookings(workspaceId, clientId);

    expect(rows.length).toBeLessThanOrEqual(50);
  });

  it("maps fields correctly (id, title, status, firstSessionStart, lastSessionEnd, total, currency)", async () => {
    const clientId = new Types.ObjectId();
    const start = new Date("2024-03-15T10:00:00Z");

    await seedBooking(workspaceId, clientId, {
      title: "Field Test Booking",
      status: "completed",
      startAt: start,
      total: 12500,
      currency: "USD",
    });

    const rows = await getClientBookings(workspaceId, clientId);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(typeof row.id).toBe("string");
    expect(row.title).toBe("Field Test Booking");
    expect(row.status).toBe("completed");
    expect(row.firstSessionStart).toBeInstanceOf(Date);
    expect(row.lastSessionEnd).toBeInstanceOf(Date);
    expect(row.total).toBe(12500);
    expect(row.currency).toBe("USD");
  });
});
