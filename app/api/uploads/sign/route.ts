import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { signUpload, workspaceFolder } from "@/lib/storage/cloudinary";

export const runtime = "nodejs";

const bodySchema = z.object({
  subfolder: z
    .string()
    .max(40)
    .regex(/^[a-z0-9_-]*$/i, "subfolder must be alphanumeric / dash / underscore")
    .optional(),
  publicId: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const ctx = await requireOrg({ allowDuringOnboarding: true });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const folder = workspaceFolder(
    ctx.workspace._id.toString(),
    parsed.data.subfolder ?? "gallery"
  );

  const params = signUpload({ folder, publicId: parsed.data.publicId });
  return NextResponse.json(params);
}
