import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace, PageviewRollup } from "@/lib/db/models";
import { localDayStart } from "@/lib/utils/timezone";
import { POST } from "./route";

const REAL_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function beacon(body: unknown, ua = REAL_UA, ip = "1.2.3.4") {
  return new Request("http://studio.test/api/public/pageviews", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": ua, "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

async function seedWs() {
  return Workspace.create({
    slug: "studio-x",
    name: "Studio X",
    ownerUserId: "u1",
    currency: "PHP",
    timezone: "Asia/Manila",
    publicPage: { publishedAt: new Date(), data: { home: null, gallery: null } },
  });
}

describe("POST /api/public/pageviews", () => {
  it("records a real view (204), but silently ignores bots without writing", async () => {
    const ws = await seedWs();
    const day = localDayStart("Asia/Manila", new Date());

    const res = await POST(beacon({ orgSlug: "studio-x", page: "home" }));
    expect(res.status).toBe(204);

    const home = await PageviewRollup.findOne({ workspaceId: ws._id, date: day, page: "home" }).lean();
    expect(home?.views).toBe(1);
    const site = await PageviewRollup.findOne({ workspaceId: ws._id, date: day, page: "_site" }).lean();
    expect(site?.visitors).toBe(1);

    // Bot UA → 204 and no new write.
    const botRes = await POST(beacon({ orgSlug: "studio-x", page: "home" }, "curl/8.0"));
    expect(botRes.status).toBe(204);
    const homeAfter = await PageviewRollup.findOne({ workspaceId: ws._id, date: day, page: "home" }).lean();
    expect(homeAfter?.views).toBe(1);

    // Unknown slug → 204, no throw.
    const missRes = await POST(beacon({ orgSlug: "nope", page: "home" }));
    expect(missRes.status).toBe(204);
  });

  it("caps repeated views from a single client (per ip+slug+page)", async () => {
    const ws = await seedWs();
    const day = localDayStart("Asia/Manila", new Date());
    // 15 hits from one IP on one page; the per-(ip,slug,page) cap is 10/min.
    for (let i = 0; i < 15; i += 1) {
      await POST(beacon({ orgSlug: "studio-x", page: "gallery" }, REAL_UA, "5.5.5.5"));
    }
    const g = await PageviewRollup.findOne({ workspaceId: ws._id, date: day, page: "gallery" }).lean();
    expect(g?.views).toBeGreaterThan(0);
    expect(g?.views).toBeLessThanOrEqual(10);
  });
});
