import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { runImportRecoverySweep } from "@/lib/bookings/import-jobs";

export const runtime = "nodejs";

/** Called only by the custom server with a per-process token after startup and each minute. */
export async function GET(req: Request) {
  const expected = process.env["GALLURIO_IMPORT_RECOVERY_TOKEN"];
  const supplied = req.headers.get("authorization") ?? "";
  if (!expected || !timingSafeEqual(
    createHash("sha256").update(supplied).digest(),
    createHash("sha256").update(`Bearer ${expected}`).digest()
  )) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { scheduled, notifications } = await runImportRecoverySweep();
  return NextResponse.json({ scheduled, notifications }, { headers: { "Cache-Control": "no-store" } });
}
