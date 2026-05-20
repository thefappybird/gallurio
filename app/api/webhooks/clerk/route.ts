import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type {
  UserJSON,
  OrganizationJSON,
  OrganizationMembershipJSON,
  DeletedObjectJSON,
} from "@clerk/nextjs/server";
import { connectDB } from "@/lib/db/mongoose";
import { User, Workspace } from "@/lib/db/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClerkWebhookEvent =
  | { type: "user.created" | "user.updated"; data: UserJSON }
  | { type: "user.deleted"; data: DeletedObjectJSON }
  | { type: "organization.created" | "organization.updated"; data: OrganizationJSON }
  | { type: "organization.deleted"; data: DeletedObjectJSON }
  | {
      type:
        | "organizationMembership.created"
        | "organizationMembership.updated"
        | "organizationMembership.deleted";
      data: OrganizationMembershipJSON;
    };

function primaryEmail(u: UserJSON): string {
  const primary = u.email_addresses?.find((e) => e.id === u.primary_email_address_id);
  return primary?.email_address ?? u.email_addresses?.[0]?.email_address ?? "";
}

function fullName(u: UserJSON): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret || secret === "whsec_xxx") {
    return NextResponse.json(
      { error: "CLERK_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${msg}` },
      { status: 400 }
    );
  }

  await connectDB();

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const u = event.data;
        await User.findOneAndUpdate(
          { clerkUserId: u.id },
          {
            $set: {
              email: primaryEmail(u),
              name: fullName(u),
              avatarUrl: u.image_url ?? null,
            },
            $setOnInsert: {
              clerkUserId: u.id,
              onboardingStep: "business",
              memberships: [],
            },
          },
          { upsert: true }
        );
        break;
      }
      case "user.deleted": {
        if (event.data.id) {
          await User.deleteOne({ clerkUserId: event.data.id });
        }
        break;
      }
      case "organization.created":
      case "organization.updated": {
        const o = event.data;
        await Workspace.findOneAndUpdate(
          { clerkOrgId: o.id },
          {
            $set: {
              name: o.name,
              slug: o.slug ?? o.id,
            },
            $setOnInsert: {
              clerkOrgId: o.id,
              ownerUserId: o.created_by ?? "",
              plan: "free",
            },
          },
          { upsert: true }
        );
        break;
      }
      case "organization.deleted": {
        if (event.data.id) {
          await Workspace.deleteOne({ clerkOrgId: event.data.id });
        }
        break;
      }
      case "organizationMembership.created":
      case "organizationMembership.updated": {
        const m = event.data;
        const workspace = await Workspace.findOne({ clerkOrgId: m.organization.id })
          .select({ _id: 1 })
          .lean();
        if (!workspace) break;
        const role = m.role === "org:admin" ? "owner" : "staff";
        await User.findOneAndUpdate(
          { clerkUserId: m.public_user_data.user_id },
          {
            $pull: { memberships: { workspaceId: workspace._id } },
          }
        );
        await User.findOneAndUpdate(
          { clerkUserId: m.public_user_data.user_id },
          {
            $push: { memberships: { workspaceId: workspace._id, role } },
          }
        );
        break;
      }
      case "organizationMembership.deleted": {
        const m = event.data;
        const workspace = await Workspace.findOne({ clerkOrgId: m.organization.id })
          .select({ _id: 1 })
          .lean();
        if (!workspace) break;
        await User.findOneAndUpdate(
          { clerkUserId: m.public_user_data.user_id },
          { $pull: { memberships: { workspaceId: workspace._id } } }
        );
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[clerk-webhook] handler failed`, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
