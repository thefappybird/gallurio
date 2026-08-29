import { z } from "zod";
import { draftSnapshotSchema } from "./portfolioDraft";

// Mirrors lib/page-builder/demoSession.ts's DemoLibraryImage shape, minus
// `url` — the client-supplied URL is never trusted (it comes straight out of
// localStorage). The server always derives the stored URL itself from the
// ownership-verified publicId via imageDeliveryUrl.
export const demoImportImageSchema = z.object({
  publicId: z.string().min(1).max(300),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});

export const demoImportSchema = z.object({
  // MUST stay a UUID. This value is compared against the asset's Cloudflare
  // `workspaceId` metadata, so accepting an arbitrary string would let a caller
  // pass a victim WORKSPACE's ObjectId together with a publicId harvested from
  // that workspace's public portfolio, clear the ownership check, and re-parent
  // someone else's asset. Demo sessions are crypto.randomUUID() — see
  // lib/page-builder/demoSession.ts — so a 24-hex ObjectId can never be one.
  demoSessionId: z.string().uuid(),
  draft: draftSnapshotSchema,
  // The demo caps uploads at 10 per session (see the upload route's
  // DEMO_IMAGE_CAP) — 20 leaves slack without accepting an unbounded array.
  images: z.array(demoImportImageSchema).max(20),
});

export type DemoImportInput = z.infer<typeof demoImportSchema>;
