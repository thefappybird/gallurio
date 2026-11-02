import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  rescheduleInquirySessionAction,
  type RescheduleSessionInput,
} from "@/app/[locale]/(app)/inquiries/_actions";

export const runtime = "nodejs";

/**
 * Action error code -> HTTP status. Body is the action result unchanged
 * ({ error } or { error: "stale", updatedAt }). Everything not listed
 * (validation messages, not_reschedulable, session_index_out_of_range,
 * aborted) is a 400.
 */
function errorStatus(error: string): number {
  if (error === "not_found") return 404;
  if (error === "stale" || error === "conflict") return 409;
  if (error === "conflict_check_failed" || error === "reschedule_failed") return 500;
  return 400;
}

export async function PATCH(req: Request) {
  if (!(await getAuthUser())) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const input = await req.json().catch(() => null);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  // The action validates this payload and resolves the workspace from the
  // authenticated session before it reads or writes any inquiry.
  const result = await rescheduleInquirySessionAction(input as RescheduleSessionInput, req.signal);
  const status = "error" in result ? errorStatus(result.error) : 200;
  return NextResponse.json(result, { status });
}
