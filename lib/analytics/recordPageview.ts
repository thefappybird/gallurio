import "server-only";
import type { Types } from "mongoose";
import { PageviewRollup, PageviewVisitorSeen } from "@/lib/db/models";
import type { PageviewPage } from "./pageview";

type RecordPageviewArgs = {
  workspaceId: Types.ObjectId;
  page: PageviewPage;
  visitorHash: string;
  /** Already-classified traffic-source bucket (dotted-path-safe). */
  source: string;
  /** Rollup day bucket (workspace-local midnight as a UTC instant). */
  day: Date;
};

/**
 * Record one portfolio page view into the anonymous daily rollups. Always bumps
 * `views` on the page doc and the "_site" doc; bumps unique `visitors` (site-wide
 * + the source bucket on "_site", and per-page on the page doc) only the first
 * time this visitorHash is seen for that scope today (atomic test-and-set against
 * PageviewVisitorSeen's unique index). Throws on DB error — the caller (beacon)
 * swallows it so tracking can never break the public page.
 */
export async function recordPageview({
  workspaceId,
  page,
  visitorHash,
  source,
  day,
}: RecordPageviewArgs): Promise<void> {
  await PageviewRollup.updateOne(
    { workspaceId, date: day, page },
    { $inc: { views: 1 } },
    { upsert: true }
  );
  await PageviewRollup.updateOne(
    { workspaceId, date: day, page: "_site" },
    { $inc: { views: 1 } },
    { upsert: true }
  );

  // Test-and-set against the unique index: a fresh marker = new unique visitor
  // for that scope today. "_site" is the portfolio-wide unique count + source
  // attribution; `page` is the per-page unique count.
  if (await isNewVisitor(workspaceId, day, "_site", visitorHash)) {
    await PageviewRollup.updateOne(
      { workspaceId, date: day, page: "_site" },
      { $inc: { visitors: 1, [`sources.${source}`]: 1 } },
      { upsert: true }
    );
  }
  if (await isNewVisitor(workspaceId, day, page, visitorHash)) {
    await PageviewRollup.updateOne(
      { workspaceId, date: day, page },
      { $inc: { visitors: 1 } },
      { upsert: true }
    );
  }
}

/** Atomic test-and-set: true the first time `visitorHash` is seen for the scope today. */
async function isNewVisitor(
  workspaceId: Types.ObjectId,
  day: Date,
  scope: string,
  visitorHash: string
): Promise<boolean> {
  try {
    await PageviewVisitorSeen.create({ workspaceId, date: day, scope, visitorHash });
    return true;
  } catch (err) {
    // Duplicate key → already counted today. Anything else is a real failure.
    if ((err as { code?: number })?.code !== 11000) throw err;
    return false;
  }
}
