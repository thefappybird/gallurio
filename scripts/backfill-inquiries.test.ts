/**
 * Integration tests for the backfill-inquiries migration logic.
 *
 * Tests the two migrations in isolation against in-memory MongoDB:
 *  1. eventDate backfill: sets eventDate from earliest session.startDate
 *  2. "contacted" -> "approved" status rename
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Inquiry } from "@/lib/db/models";

const workspaceId = new Types.ObjectId();

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

// ── Helpers that mirror backfill logic (avoids importing the script directly) ─

function earliestDateFromSessions(sessions: { startDate: string }[]): Date | null {
  const dates = sessions
    .map((s) => s.startDate)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return null;
  const parsed = new Date(`${dates[0]}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function runEventDateBackfill() {
  // Use updateOne per document to precisely mirror the script logic.
  const noDate = await Inquiry.find({ eventDate: null }).lean();
  let fixed = 0;
  for (const inq of noDate) {
    const sessions = (inq.sessions ?? []) as { startDate: string }[];
    const earliest = earliestDateFromSessions(sessions);
    if (!earliest) continue;
    await Inquiry.updateOne({ _id: inq._id, eventDate: null }, { $set: { eventDate: earliest } });
    fixed += 1;
  }
  return fixed;
}

async function runStatusRename() {
  const result = await Inquiry.updateMany(
    { status: "contacted" },
    { $set: { status: "approved" } }
  );
  return result.modifiedCount;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("backfill: eventDate", () => {
  it("sets eventDate to the earliest session.startDate for inquiries with null eventDate", async () => {
    // Use raw insertOne to bypass the schema's required: true on eventDate.
    await mongoose.connection.collection("inquiries").insertOne({
      workspaceId,
      name: "Test",
      email: "t@x.com",
      status: "new",
      eventDate: null,
      sessions: [
        { startDate: "2030-08-20", startTime: "10:00", endTime: "18:00" },
        { startDate: "2030-08-15", startTime: "09:00", endTime: "17:00" },
      ],
    });

    const fixed = await runEventDateBackfill();
    expect(fixed).toBe(1);

    const updated = await mongoose.connection.collection("inquiries").findOne({ email: "t@x.com" });
    expect(updated?.eventDate).toBeTruthy();
    expect(updated!.eventDate.toISOString().startsWith("2030-08-15")).toBe(true);
  });

  it("is idempotent — does not modify inquiries that already have an eventDate", async () => {
    const existing = new Date("2030-09-01T00:00:00Z");
    await Inquiry.create({
      workspaceId,
      name: "Test",
      email: "t@x.com",
      status: "new",
      eventDate: existing,
      sessions: [{ startDate: "2030-08-15", startTime: "09:00", endTime: "17:00" }],
    });

    const fixed = await runEventDateBackfill();
    expect(fixed).toBe(0);

    const doc = await Inquiry.findOne({ email: "t@x.com" }).lean();
    expect(doc?.eventDate?.toISOString()).toBe(existing.toISOString());
  });

  it("skips inquiries with no sessions", async () => {
    await mongoose.connection.collection("inquiries").insertOne({
      workspaceId,
      name: "No sessions",
      email: "ns@x.com",
      status: "new",
      eventDate: null,
      sessions: [],
    });

    const fixed = await runEventDateBackfill();
    expect(fixed).toBe(0);

    const doc = await mongoose.connection.collection("inquiries").findOne({ email: "ns@x.com" });
    expect(doc?.eventDate).toBeNull();
  });
});

describe("backfill: contacted -> approved rename", () => {
  it("renames contacted inquiries to approved", async () => {
    await mongoose.connection.collection("inquiries").insertMany([
      { workspaceId, name: "A", email: "a@x.com", status: "contacted", eventDate: new Date() },
      { workspaceId, name: "B", email: "b@x.com", status: "contacted", eventDate: new Date() },
      { workspaceId, name: "C", email: "c@x.com", status: "new", eventDate: new Date() },
    ]);

    const modified = await runStatusRename();
    expect(modified).toBe(2);

    const approved = await mongoose.connection.collection("inquiries").countDocuments({ status: "approved" });
    const contacted = await mongoose.connection.collection("inquiries").countDocuments({ status: "contacted" });
    const newCount = await mongoose.connection.collection("inquiries").countDocuments({ status: "new" });

    expect(approved).toBe(2);
    expect(contacted).toBe(0);
    expect(newCount).toBe(1);
  });

  it("is idempotent — running twice does not change already-approved inquiries", async () => {
    await mongoose.connection.collection("inquiries").insertOne({
      workspaceId,
      name: "A",
      email: "a@x.com",
      status: "contacted",
      eventDate: new Date(),
    });

    await runStatusRename();
    const secondRun = await runStatusRename();
    expect(secondRun).toBe(0);

    const doc = await mongoose.connection.collection("inquiries").findOne({ email: "a@x.com" });
    expect(doc?.status).toBe("approved");
  });
});
