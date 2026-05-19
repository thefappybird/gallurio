"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, User } from "@/lib/db/models";
import { createWorkspaceSchema, type CreateWorkspaceInput } from "@/lib/validators/workspace";

export async function createWorkspaceAction(
  input: CreateWorkspaceInput
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session.userId) return { error: "Not authenticated" };

  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { name, slug, businessType } = parsed.data;

  await connectDB();

  const existing = await Workspace.findOne({ slug }).lean();
  if (existing) return { error: "That slug is already taken — try another." };

  const clerk = await clerkClient();

  let clerkOrg: { id: string };
  try {
    clerkOrg = await clerk.organizations.createOrganization({
      name,
      createdBy: session.userId,
      slug,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create organization";
    if (msg.toLowerCase().includes("slug")) {
      return { error: "That slug is already taken — try another." };
    }
    return { error: msg };
  }

  await Promise.all([
    Workspace.create({
      slug,
      name,
      ownerUserId: session.userId,
      clerkOrgId: clerkOrg.id,
      businessType,
      plan: "free",
    }),
    User.findOneAndUpdate(
      { clerkUserId: session.userId },
      {
        $setOnInsert: { clerkUserId: session.userId, email: "", name: "" },
        $addToSet: {
          memberships: {
            workspaceId: null,
            role: "owner" as const,
          },
        },
      },
      { upsert: true }
    ),
  ]);

  redirect("/dashboard");
}
