import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type {
  UserJSON,
  OrganizationJSON,
  OrganizationMembershipJSON,
  DeletedObjectJSON,
} from "@clerk/nextjs/server";
import { connectDB } from "@/lib/db/mongoose";
import {
  User,
  Workspace,
  Team,
  TeamMembership,
  PendingTeamAssignment,
} from "@/lib/db/models";
import { releaseTeamSeat } from "@/lib/auth/assertCanAddTeamMember";

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
        const clerkUserId = m.public_user_data.user_id;
        await User.findOneAndUpdate(
          { clerkUserId },
          { $pull: { memberships: { workspaceId: workspace._id } } }
        );
        await User.findOneAndUpdate(
          { clerkUserId },
          { $push: { memberships: { workspaceId: workspace._id, role } } }
        );

        // Drain pending team assignments only on first membership creation.
        // `organizationMembership.updated` can re-fire (e.g. role change) but
        // the pending row will have already been deleted by then, so the
        // findOne below is a no-op.
        const memberEmail = (
          m.public_user_data.identifier ?? ""
        ).toLowerCase();
        if (memberEmail && role === "staff") {
          const pending = await PendingTeamAssignment.findOne({
            workspaceId: workspace._id,
            email: memberEmail,
          }).lean();
          if (pending) {
            const leadSet = new Set(
              (pending.leadOnTeamIds ?? []).map((id) => String(id)),
            );
            for (const teamId of pending.teamIds ?? []) {
              const team = await Team.findOne({
                _id: teamId,
                workspaceId: workspace._id,
              })
                .select({ _id: 1 })
                .lean();
              if (!team) {
                // Team deleted between invite and accept — release the seat
                // we reserved at invite time. (No-op if already 0.)
                await releaseTeamSeat(teamId);
                console.warn(
                  `[clerk-webhook] dropping pending assignment for deleted team`,
                  { workspaceId: String(workspace._id), teamId: String(teamId), email: memberEmail },
                );
                continue;
              }
              try {
                await TeamMembership.create({
                  workspaceId: workspace._id,
                  teamId,
                  clerkUserId,
                  role: leadSet.has(String(teamId)) ? "lead" : "member",
                });
              } catch (err) {
                if (
                  typeof err === "object" &&
                  err !== null &&
                  "code" in err &&
                  (err as { code: unknown }).code === 11000
                ) {
                  // Idempotent: webhook retry. Seat was reserved exactly once
                  // at invite time, so do not release.
                  continue;
                }
                throw err;
              }
            }
            await PendingTeamAssignment.deleteOne({ _id: pending._id });
          }
        }
        break;
      }
      case "organizationMembership.deleted": {
        const m = event.data;
        const workspace = await Workspace.findOne({ clerkOrgId: m.organization.id })
          .select({ _id: 1 })
          .lean();
        if (!workspace) break;
        const clerkUserId = m.public_user_data.user_id;

        const memberships = await TeamMembership.find({
          workspaceId: workspace._id,
          clerkUserId,
        })
          .select({ teamId: 1 })
          .lean();

        await TeamMembership.deleteMany({
          workspaceId: workspace._id,
          clerkUserId,
        });

        for (const tm of memberships) {
          await releaseTeamSeat(tm.teamId);
        }

        await User.findOneAndUpdate(
          { clerkUserId },
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
