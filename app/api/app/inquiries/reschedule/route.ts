import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  rescheduleInquirySessionAction,
  type RescheduleSessionInput,
} from "@/app/[locale]/(app)/inquiries/_actions";

export const runtime = "nodejs";

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
  const status = "error" in result ? (result.error === "stale" ? 409 : 400) : 200;
  return NextResponse.json(result, { status });
}
