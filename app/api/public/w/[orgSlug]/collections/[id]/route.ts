import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { listPublicCollectionItemsPage } from "@/lib/db/queries/gallery";

export const runtime = "nodejs";

type Params = { params: Promise<{ orgSlug: string; id: string }> };

/**
 * GET /api/public/w/[orgSlug]/collections/[id]?cursor=<c>&limit=<n>
 *
 * Public, slug-scoped paginated read of a published workspace's PUBLIC collection
 * images, for the Featured Work popup. Resolves orgSlug→workspaceId (publish-gated;
 * 404 before any item read). workspaceId is NEVER client-supplied. The collection's
 * isPublic gates visibility (items have no isPublic field). Response:
 * { items: { id, publicId, alt }[]; nextCursor }.
 */
export async function GET(req: Request, { params }: Params) {
  const { orgSlug, id } = await params;

  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!isValidObjectId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw == null ? undefined : Number(limitRaw);

  const page = await listPublicCollectionItemsPage({
    workspaceId: String(workspace._id),
    collectionId: id,
    cursor,
    limit,
  });

  return NextResponse.json(page);
}
