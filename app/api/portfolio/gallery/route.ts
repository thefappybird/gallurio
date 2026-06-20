import { NextResponse } from "next/server";
import { requireApiOrg } from "@/lib/auth/apiOrgContext";
import { listCollectionsForPicker, listItemsForPicker } from "@/lib/db/queries/gallery";

export const runtime = "nodejs";

/**
 * GET /api/portfolio/gallery
 *
 * Returns gallery data for the in-editor collection and item pickers.
 * Owner-only; non-owners receive 403.
 *
 * Response: { collections: PickerCollection[], items: PickerItem[] }
 */
export async function GET() {
  const auth = await requireApiOrg();
  if (!auth.ok) return auth.response;
  const ctx = auth.ctx;
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const workspaceId = ctx.workspace._id.toString();

  const [collections, items] = await Promise.all([
    listCollectionsForPicker(workspaceId),
    listItemsForPicker(workspaceId),
  ]);

  return NextResponse.json({ collections, items });
}
