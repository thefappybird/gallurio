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
 * `views` on the page doc and the "_site" doc; bumps unique `visitors` + the
 * source bucket only the first time this visitorHash is seen for the day (atomic
 * test-and-set against PageviewVisitorSeen's unique index). Throws on DB error —
 * the caller (beacon) swallows it so tracking can never break the public page.
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

  // Test-and-set against the unique index: a fresh marker = new unique visitor.
  let isNewVisitor = false;
  try {
    await PageviewVisitorSeen.create({
      workspaceId,
      date: day,
      scope: "_site",
      visitorHash,
    });
    isNewVisitor = true;
  } catch (err) {
    // Duplicate key → already counted today. Anything else is a real failure.
    if ((err as { code?: number })?.code !== 11000) throw err;
  }

  if (isNewVisitor) {
    await PageviewRollup.updateOne(
      { workspaceId, date: day, page: "_site" },
      { $inc: { visitors: 1, [`sources.${source}`]: 1 } },
      { upsert: true }
    );
  }
}
