import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { PageviewRollup, Inquiry, Client } from "@/lib/db/models";
import {
  getAnalyticsTotals,
  getPageviewTimeSeries,
  getPerPageBreakdown,
  getTopSources,
  getInquiryInsights,
} from "./portfolio-analytics";

const wid = new Types.ObjectId();
const other = new Types.ObjectId();
const day1 = new Date("2026-06-01T00:00:00.000Z");
const day2 = new Date("2026-06-02T00:00:00.000Z");

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

async function seed() {
  await PageviewRollup.create([
    { workspaceId: wid, date: day1, page: "_site", views: 10, visitors: 6, inquiries: 2, sources: { direct: 4, instagram: 2 } },
    { workspaceId: wid, date: day2, page: "_site", views: 5, visitors: 3, inquiries: 1, sources: { direct: 3 } },
    { workspaceId: wid, date: day1, page: "home", views: 7, visitors: 5 },
    { workspaceId: wid, date: day1, page: "gallery", views: 3, visitors: 2 },
    { workspaceId: other, date: day1, page: "_site", views: 99, visitors: 99, inquiries: 9 },
  ]);
}

describe("getAnalyticsTotals", () => {
  it("sums site totals in range and computes conversion = inquiries/visitors", async () => {
    await seed();
    const t = await getAnalyticsTotals(wid, { from: null, to: null });
    expect(t.views).toBe(15);
    expect(t.visitors).toBe(9);
    expect(t.inquiries).toBe(3);
    expect(t.conversionRate).toBeCloseTo(3 / 9, 5);

    // Range filter: only day1.
    const d1 = await getAnalyticsTotals(wid, { from: day1, to: day1 });
    expect(d1.views).toBe(10);
    expect(d1.visitors).toBe(6);
  });
});

describe("getPageviewTimeSeries", () => {
  it("returns site views/visitors per day, ascending, within range", async () => {
    await seed();
    const series = await getPageviewTimeSeries(wid, { from: null, to: null });
    expect(series).toEqual([
      { date: "2026-06-01", views: 10, visitors: 6 },
      { date: "2026-06-02", views: 5, visitors: 3 },
    ]);
  });
});

describe("getPerPageBreakdown", () => {
  it("groups real pages (excludes _site) by views desc", async () => {
    await seed();
    const rows = await getPerPageBreakdown(wid, { from: null, to: null });
    expect(rows).toEqual([
      { page: "home", views: 7, visitors: 5 },
      { page: "gallery", views: 3, visitors: 2 },
    ]);
  });
});

describe("getTopSources", () => {
  it("aggregates the _site sources map across days, desc", async () => {
    await seed();
    const rows = await getTopSources(wid, { from: null, to: null }, 8);
    expect(rows).toEqual([
      { source: "direct", visitors: 7 },
      { source: "instagram", visitors: 2 },
    ]);
  });
});

describe("getInquiryInsights", () => {
  it("computes inquiry totals, booking conversion, and new form clients in range", async () => {
    const ed = new Date("2026-06-10T00:00:00.000Z");
    await Inquiry.create([
      { workspaceId: wid, name: "A", email: "a@x.com", eventDate: ed, status: "inquiry" },
      { workspaceId: wid, name: "B", email: "b@x.com", eventDate: ed, status: "inquiry" },
      { workspaceId: wid, name: "C", email: "c@x.com", eventDate: ed, status: "inquiry" },
      { workspaceId: wid, name: "D", email: "d@x.com", eventDate: ed, status: "booked" },
      { workspaceId: wid, name: "E", email: "e@x.com", eventDate: ed, status: "converted" },
      { workspaceId: other, name: "Z", email: "z@x.com", eventDate: ed, status: "booked" },
    ]);
    await Client.create([
      { workspaceId: wid, name: "FC1", source: "form" },
      { workspaceId: wid, name: "FC2", source: "form" },
      { workspaceId: wid, name: "M1", source: "manual" },
      { workspaceId: other, name: "OZ", source: "form" },
    ]);

    const ins = await getInquiryInsights(wid, { from: null, to: null });
    expect(ins.totalInquiries).toBe(5);
    expect(ins.bookedCount).toBe(2);
    expect(ins.inquiryToBookingRate).toBeCloseTo(2 / 5, 5);
    expect(ins.newClientsFromForm).toBe(2);
  });
});
