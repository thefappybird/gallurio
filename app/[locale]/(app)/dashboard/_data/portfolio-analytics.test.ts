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
  getVisitorInquirySeries,
  getInquiryPipeline,
  getContactFunnel,
  getDemandProfile,
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

describe("getVisitorInquirySeries", () => {
  it("sums both days of the same ISO week into a single weekly point", async () => {
    await seed();
    const series = await getVisitorInquirySeries(wid, { from: day1, to: day2 }, "UTC");
    // day1 (Mon 2026-06-01) and day2 (Tue 2026-06-02) fall in the same ISO
    // week (Mon 2026-06-01), so weekly bucketing collapses them into one point.
    expect(series).toEqual([{ date: "2026-06-01", visitors: 9, inquiries: 3 }]);
  });

  it("excludes other workspaces' rollups", async () => {
    await seed();
    const series = await getVisitorInquirySeries(wid, { from: day1, to: day1 }, "UTC");
    expect(series).toEqual([{ date: "2026-06-01", visitors: 6, inquiries: 2 }]);
  });

  it("returns an empty array when unbounded and no _site data exists", async () => {
    const series = await getVisitorInquirySeries(wid, { from: null, to: null }, "UTC");
    expect(series).toEqual([]);
  });

  it("zero-fills a bounded window that has no matching data", async () => {
    const day3 = new Date("2026-06-03T00:00:00.000Z"); // Wed, same ISO week as day1/day2 (Mon 2026-06-01)
    const series = await getVisitorInquirySeries(wid, { from: day3, to: day3 }, "UTC");
    expect(series).toEqual([{ date: "2026-06-01", visitors: 0, inquiries: 0 }]);
  });
});

describe("getInquiryPipeline", () => {
  it("buckets inquiries created in range into new/booked/archived", async () => {
    const ed = new Date("2026-06-10T00:00:00.000Z");
    const inRange = new Date("2026-06-05T00:00:00.000Z");
    await Inquiry.create([
      { workspaceId: wid, name: "A", email: "a@x.com", eventDate: ed, status: "inquiry", createdAt: inRange },
      { workspaceId: wid, name: "B", email: "b@x.com", eventDate: ed, status: "booked", createdAt: inRange },
      { workspaceId: wid, name: "C", email: "c@x.com", eventDate: ed, status: "converted", createdAt: inRange },
      { workspaceId: wid, name: "D", email: "d@x.com", eventDate: ed, status: "archived", createdAt: inRange },
    ]);
    const pipeline = await getInquiryPipeline(wid, { from: null, to: null });
    expect(pipeline).toEqual({ total: 4, newCount: 1, booked: 2, archived: 1 });
  });

  it("excludes other workspaces' inquiries", async () => {
    const ed = new Date("2026-06-10T00:00:00.000Z");
    await Inquiry.create([
      { workspaceId: wid, name: "A", email: "a@x.com", eventDate: ed, status: "inquiry" },
      { workspaceId: other, name: "Z", email: "z@x.com", eventDate: ed, status: "inquiry" },
    ]);
    const pipeline = await getInquiryPipeline(wid, { from: null, to: null });
    expect(pipeline).toEqual({ total: 1, newCount: 1, booked: 0, archived: 0 });
  });

  it("returns zeros for an empty range", async () => {
    const ed = new Date("2026-06-10T00:00:00.000Z");
    await Inquiry.create({ workspaceId: wid, name: "A", email: "a@x.com", eventDate: ed, status: "inquiry" });
    const pipeline = await getInquiryPipeline(wid, {
      from: new Date("2099-01-01T00:00:00.000Z"),
      to: new Date("2099-01-02T00:00:00.000Z"),
    });
    expect(pipeline).toEqual({ total: 0, newCount: 0, booked: 0, archived: 0 });
  });

  it("includes createdAt at the exact range boundaries, excludes just outside", async () => {
    const ed = new Date("2026-06-10T00:00:00.000Z");
    await Inquiry.create([
      { workspaceId: wid, name: "In1", email: "in1@x.com", eventDate: ed, status: "inquiry", createdAt: day1 },
      { workspaceId: wid, name: "In2", email: "in2@x.com", eventDate: ed, status: "inquiry", createdAt: day2 },
      {
        workspaceId: wid,
        name: "Out",
        email: "out@x.com",
        eventDate: ed,
        status: "inquiry",
        createdAt: new Date(day2.getTime() + 1),
      },
    ]);
    const pipeline = await getInquiryPipeline(wid, { from: day1, to: day2 });
    expect(pipeline.total).toBe(2);
  });
});

describe("getContactFunnel", () => {
  it("sums visitorDays/contactVisitorDays/inquiries and flags contact tracking", async () => {
    await seed();
    await PageviewRollup.create([
      { workspaceId: wid, date: day1, page: "contact", views: 4, visitors: 2 },
      { workspaceId: wid, date: day2, page: "contact", views: 2, visitors: 1 },
    ]);
    const funnel = await getContactFunnel(wid, { from: null, to: null });
    expect(funnel).toEqual({ visitorDays: 9, contactVisitorDays: 3, inquiries: 3, contactTracked: true });
  });

  it("excludes other workspaces' rollups", async () => {
    await seed();
    await PageviewRollup.create([
      { workspaceId: wid, date: day1, page: "contact", views: 4, visitors: 2 },
      { workspaceId: other, date: day1, page: "contact", views: 40, visitors: 20 },
    ]);
    const funnel = await getContactFunnel(wid, { from: null, to: null });
    expect(funnel).toEqual({ visitorDays: 9, contactVisitorDays: 2, inquiries: 3, contactTracked: true });
  });

  it("returns zeros and contactTracked=false for an empty range with no data", async () => {
    const funnel = await getContactFunnel(wid, { from: null, to: null });
    expect(funnel).toEqual({ visitorDays: 0, contactVisitorDays: 0, inquiries: 0, contactTracked: false });
  });

  it("filters by range: day1-only excludes day2 contact/_site data", async () => {
    await seed();
    await PageviewRollup.create([
      { workspaceId: wid, date: day1, page: "contact", views: 4, visitors: 2 },
      { workspaceId: wid, date: day2, page: "contact", views: 2, visitors: 1 },
    ]);
    const funnel = await getContactFunnel(wid, { from: day1, to: day1 });
    expect(funnel).toEqual({ visitorDays: 6, contactVisitorDays: 2, inquiries: 2, contactTracked: true });
  });
});

describe("getDemandProfile", () => {
  it("computes eventType mix, requested months, and median lead time", async () => {
    await Inquiry.create([
      {
        workspaceId: wid,
        name: "A",
        email: "a@x.com",
        eventType: "wedding",
        eventDate: new Date("2026-07-01T00:00:00.000Z"),
        createdAt: day1,
      },
      {
        workspaceId: wid,
        name: "B",
        email: "b@x.com",
        eventType: "wedding",
        eventDate: new Date("2026-07-15T00:00:00.000Z"),
        createdAt: day1,
      },
      {
        workspaceId: wid,
        name: "C",
        email: "c@x.com",
        eventType: "birthday",
        eventDate: new Date("2026-08-01T00:00:00.000Z"),
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
      },
    ]);

    const profile = await getDemandProfile(wid, { from: null, to: null }, "UTC");
    expect(profile.eventTypeMix).toEqual([
      { eventType: "wedding", count: 2 },
      { eventType: "birthday", count: 1 },
    ]);
    expect(profile.requestedMonths).toEqual([
      { month: "2026-07", count: 2 },
      { month: "2026-08", count: 1 },
    ]);
    expect(profile.medianLeadTimeDays).toBe(44);
  });

  it("excludes other workspaces' inquiries", async () => {
    await Inquiry.create([
      {
        workspaceId: wid,
        name: "A",
        email: "a@x.com",
        eventType: "wedding",
        eventDate: new Date("2026-07-01T00:00:00.000Z"),
        createdAt: day1,
      },
      {
        workspaceId: other,
        name: "Z",
        email: "z@x.com",
        eventType: "corporate",
        eventDate: new Date("2026-09-01T00:00:00.000Z"),
        createdAt: day1,
      },
    ]);
    const profile = await getDemandProfile(wid, { from: null, to: null }, "UTC");
    expect(profile.eventTypeMix).toEqual([{ eventType: "wedding", count: 1 }]);
    expect(profile.requestedMonths).toEqual([{ month: "2026-07", count: 1 }]);
    expect(profile.medianLeadTimeDays).toBe(30);
  });

  it("returns empty arrays and null median for an empty range", async () => {
    const profile = await getDemandProfile(wid, { from: null, to: null }, "UTC");
    expect(profile).toEqual({ eventTypeMix: [], requestedMonths: [], medianLeadTimeDays: null });
  });

  it("filters by createdAt range, excluding inquiries created just outside it", async () => {
    await Inquiry.create([
      {
        workspaceId: wid,
        name: "In",
        email: "in@x.com",
        eventType: "wedding",
        eventDate: new Date("2026-07-01T00:00:00.000Z"),
        createdAt: day1,
      },
      {
        workspaceId: wid,
        name: "Out",
        email: "out@x.com",
        eventType: "corporate",
        eventDate: new Date("2026-09-01T00:00:00.000Z"),
        createdAt: new Date(day2.getTime() + 1),
      },
    ]);
    const profile = await getDemandProfile(wid, { from: day1, to: day2 }, "UTC");
    expect(profile.eventTypeMix).toEqual([{ eventType: "wedding", count: 1 }]);
  });
});
