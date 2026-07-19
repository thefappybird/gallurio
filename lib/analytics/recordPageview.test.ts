import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { PageviewRollup } from "@/lib/db/models";
import { recordPageview } from "./recordPageview";

const day = new Date("2026-06-01T00:00:00.000Z");

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

async function site(ws: Types.ObjectId) {
  return PageviewRollup.findOne({ workspaceId: ws, date: day, page: "_site" }).lean();
}

describe("recordPageview", () => {
  it("increments views always, but counts a unique visitor once per day per scope", async () => {
    const ws = new Types.ObjectId();

    await recordPageview({ workspaceId: ws, page: "home", visitorHash: "h1", source: "direct", day });

    const home = await PageviewRollup.findOne({ workspaceId: ws, date: day, page: "home" }).lean();
    expect(home?.views).toBe(1);
    let s = await site(ws);
    expect(s?.views).toBe(1);
    expect(s?.visitors).toBe(1);
    expect((s?.sources as Map<string, number> | undefined)?.get?.("direct") ?? (s?.sources as Record<string, number>)?.direct).toBe(1);

    // Same visitor again that day → views climb, unique visitors do not.
    await recordPageview({ workspaceId: ws, page: "home", visitorHash: "h1", source: "direct", day });
    s = await site(ws);
    expect(s?.views).toBe(2);
    expect(s?.visitors).toBe(1);

    // A different visitor from a different source.
    await recordPageview({ workspaceId: ws, page: "gallery", visitorHash: "h2", source: "instagram", day });
    s = await site(ws);
    expect(s?.views).toBe(3);
    expect(s?.visitors).toBe(2);
  });

  it("counts unique visitors per page independently of the site total", async () => {
    const ws = new Types.ObjectId();
    const page = (p: "home" | "gallery") =>
      PageviewRollup.findOne({ workspaceId: ws, date: day, page: p }).lean();

    // One visitor sees home then gallery — each page gets one unique visitor.
    await recordPageview({ workspaceId: ws, page: "home", visitorHash: "v1", source: "direct", day });
    await recordPageview({ workspaceId: ws, page: "gallery", visitorHash: "v1", source: "direct", day });
    expect((await page("home"))?.visitors).toBe(1);
    expect((await page("gallery"))?.visitors).toBe(1);
    // Site-wide still counts the visitor once.
    expect((await site(ws))?.visitors).toBe(1);

    // Same visitor revisits home → page unique visitors stays 1, views climb.
    await recordPageview({ workspaceId: ws, page: "home", visitorHash: "v1", source: "direct", day });
    const home = await page("home");
    expect(home?.visitors).toBe(1);
    expect(home?.views).toBe(2);
  });
});
