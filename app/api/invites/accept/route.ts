import "server-only";
import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Invitation } from "@/lib/db/models/Invitation";
import { User } from "@/lib/db/models/User";
import { TeamMembership } from "@/lib/db/models/teamMembership";
import { Team } from "@/lib/db/models/team";
import { getAuthUser } from "@/lib/auth/session";
import { setActiveWorkspace } from "@/lib/auth/activeWorkspace";
import { signOAuthState } from "@/lib/auth/oauthState";
import { authCookieSecure } from "@/lib/auth/cookies";
import { sendNotification } from "@/lib/notifications/send";
import mongoose from "mongoose";

// Runtime must be Node — uses crypto + Mongoose transactions.
export const runtime = "nodejs";

function sha256Hex(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function localizedUrl(req: NextRequest, path: string): string {
  // The request may arrive through a tunnel or reverse proxy whose upstream
  // host is localhost. Invite flows must always redirect to the externally
  // reachable app origin, not that internal hop.
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  let origin = req.nextUrl.origin;
  if (configuredAppUrl) {
    try {
      origin = new URL(configuredAppUrl).origin;
    } catch {
      // Environment validation catches malformed production values; keep the
      // request origin as a safe development fallback.
    }
  }
  // Default locale for error/redirect flows — the invite email link carries no
  // locale segment, so we land on the root invite path and default to "en".
  return `${origin}/en${path}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Accept the token from the query param (first visit via email link) or, if
  // absent, from the httpOnly cookie set before the OAuth round-trip. When read
  // from the cookie it must be cleared on the response (single-use).
  const tokenFromQuery = req.nextUrl.searchParams.get("token");
  const tokenFromCookie = req.cookies.get("gw_invite_token")?.value ?? null;
  const token = tokenFromQuery ?? tokenFromCookie;
  const clearInviteCookie = !tokenFromQuery && tokenFromCookie !== null;

  if (!token) {
    return NextResponse.redirect(
      new URL(localizedUrl(req, "/invite/accept?error=invalid")),
    );
  }

  const tokenHash = sha256Hex(token);

  await connectDB();

  const invitation = await Invitation.findOne({ tokenHash })
    .select({
      _id: 1,
      workspaceId: 1,
      email: 1,
      role: 1,
      teamIds: 1,
      leadOnTeamIds: 1,
      invitedByWorkosUserId: 1,
      status: 1,
      expiresAt: 1,
    })
    .lean();

  // Check invitation validity before auth — gives a clear error for bad links.
  if (!invitation) {
    return NextResponse.redirect(
      new URL(localizedUrl(req, "/invite/accept?error=invalid")),
    );
  }

  if (invitation.status !== "pending") {
    const errorParam =
      invitation.status === "accepted"
        ? "already_accepted"
        : invitation.status === "revoked"
          ? "revoked"
          : invitation.status === "expired"
            ? "expired"
            : "invalid";
    return NextResponse.redirect(
      new URL(localizedUrl(req, `/invite/accept?error=${errorParam}`)),
    );
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.redirect(
      new URL(localizedUrl(req, "/invite/accept?error=expired")),
    );
  }

  // Auth check — if not signed in, stash the token in a short-lived httpOnly
  // cookie and redirect to sign-up. The raw token never appears in any URL or
  // signed OAuth state; the callback reads the cookie and bounces back here.
  const authUser = await getAuthUser();
  if (!authUser) {
    const state = signOAuthState({ locale: "en" });
    const signUpUrl = new URL(localizedUrl(req, "/sign-up"));
    signUpUrl.searchParams.set("state", state);
    signUpUrl.searchParams.set("email", String(invitation.email));
    const res = NextResponse.redirect(signUpUrl);
    // 15 min — enough time to complete the OAuth round-trip. sameSite=lax
    // ensures the cookie survives the top-level redirect back from WorkOS.
    res.cookies.set("gw_invite_token", token, {
      httpOnly: true,
      secure: await authCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
    return res;
  }

  // Email must match the invite exactly — case-insensitive.
  if (authUser.email.toLowerCase() !== (invitation.email as string).toLowerCase()) {
    return NextResponse.redirect(
      new URL(localizedUrl(req, "/invite/accept?error=email_mismatch")),
    );
  }

  const workspaceId = invitation.workspaceId as mongoose.Types.ObjectId;
  const teamIds = (invitation.teamIds ?? []) as mongoose.Types.ObjectId[];
  const leadOnTeamIds = (invitation.leadOnTeamIds ?? []) as mongoose.Types.ObjectId[];

  // One workspace per email — if this user already belongs to a different
  // workspace, they can't also join this one. They must use another email.
  const existingUser = await User.findOne({ workosUserId: authUser.workosUserId })
    .select({ memberships: 1 })
    .lean();
  const belongsElsewhere = existingUser?.memberships.some(
    (m) => String(m.workspaceId) !== String(workspaceId),
  );
  if (belongsElsewhere) {
    return NextResponse.redirect(
      new URL(localizedUrl(req, "/invite/accept?error=already_member")),
    );
  }

  // Transactional accept — idempotent on duplicate membership (11000).
  const session = await mongoose.startSession();
  let acceptedNow = false;
  try {
    await session.withTransaction(async () => {
      // Mark invitation accepted.
      const updated = await Invitation.findOneAndUpdate(
        { _id: invitation._id, status: "pending" },
        { $set: { status: "accepted", acceptedAt: new Date() } },
        { session, new: true },
      )
        .select({ _id: 1 })
        .lean();

      // If another concurrent accept already consumed this token, abort.
      if (!updated) throw new Error("ALREADY_ACCEPTED");
      acceptedNow = true;

      // Ensure the User doc exists (JIT-provision handles first sign-up).
      const user = await User.findOneAndUpdate(
        { workosUserId: authUser.workosUserId },
        {
          $setOnInsert: {
            workosUserId: authUser.workosUserId,
            email: authUser.email.toLowerCase().trim(),
            name: authUser.name,
            avatarUrl: authUser.avatarUrl,
            memberships: [],
          },
        },
        { upsert: true, new: true, session },
      );

      if (!user) throw new Error("USER_PROVISION_FAILED");

      // Add workspace membership if not already present.
      const alreadyMember = user.memberships.some(
        (m) => String(m.workspaceId) === String(workspaceId),
      );
      if (!alreadyMember) {
        await User.updateOne(
          { workosUserId: authUser.workosUserId },
          {
            $push: {
              memberships: { workspaceId, role: invitation.role ?? "staff" },
            },
          },
          { session },
        );
      }

      // Create TeamMembership rows — skip any that already exist.
      for (const teamId of teamIds) {
        const requestedLead = leadOnTeamIds.some(
          (lid) => String(lid) === String(teamId),
        );
        // A pending invite can reserve a lead slot, but an owner may have
        // assigned somebody else before acceptance. Fall back safely to a
        // member instead of creating a second lead.
        const existingLead = requestedLead
          ? await TeamMembership.exists({ workspaceId, teamId, role: "lead" }).session(session)
          : null;
        const isLead = requestedLead && !existingLead;
        try {
          await TeamMembership.create(
            [
              {
                workspaceId,
                teamId,
                workosUserId: authUser.workosUserId,
                role: isLead ? "lead" : "member",
              },
            ],
            { session },
          );
        } catch (err) {
          // Unique-constraint violation = already a member of this team; skip.
          if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: unknown }).code === 11000
          ) {
            continue;
          }
          throw err;
        }
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "ALREADY_ACCEPTED") {
      // Race — treat as already done.
    } else {
      console.error("[invite/accept] transaction failed", err);
      return NextResponse.redirect(
        new URL(localizedUrl(req, "/invite/accept?error=failed")),
      );
    }
  } finally {
    await session.endSession();
  }

  // Notify the person who sent this invitation only after the transaction has
  // committed. One notification represents one accepted invite, even when it
  // grants membership to multiple teams.
  if (acceptedNow && invitation.invitedByWorkosUserId && teamIds[0]) {
    const [inviter, team] = await Promise.all([
      User.findOne({ workosUserId: invitation.invitedByWorkosUserId })
        .select({ workosUserId: 1, email: 1, name: 1 })
        .lean(),
      Team.findOne({ _id: teamIds[0], workspaceId }).select({ name: 1 }).lean(),
    ]);
    if (inviter) {
      await sendNotification({
        workspaceId: String(workspaceId),
        recipients: [{
          workosUserId: inviter.workosUserId,
          email: inviter.email,
          name: inviter.name || undefined,
        }],
        type: "team.invite_accepted",
        entityId: String(teamIds[0]),
        entityType: "team",
        triggeredByWorkosUserId: authUser.workosUserId,
        locale: "en",
        vars: {
          memberName: authUser.name || authUser.email,
          memberEmail: authUser.email,
          role: invitation.role ?? "staff",
          teamName: team?.name ?? "your team",
        },
      }).catch((err) => {
        console.error("[invite/accept] sendNotification (team.invite_accepted) failed:", err);
      });
    }
  }

  // Set active workspace and redirect to dashboard.
  await setActiveWorkspace(authUser.workosUserId, String(workspaceId));

  const successRes = NextResponse.redirect(
    new URL(localizedUrl(req, "/bookings")),
  );
  // Clear the invite cookie if it was the source — single-use.
  if (clearInviteCookie) {
    successRes.cookies.set("gw_invite_token", "", {
      httpOnly: true,
      secure: await authCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return successRes;
}
