import "server-only";
import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Invitation } from "@/lib/db/models/Invitation";
import { User } from "@/lib/db/models/User";
import { TeamMembership } from "@/lib/db/models/teamMembership";
import { getAuthUser } from "@/lib/auth/session";
import { setActiveWorkspace } from "@/lib/auth/activeWorkspace";
import { signOAuthState } from "@/lib/auth/oauthState";
import mongoose from "mongoose";

// Runtime must be Node — uses crypto + Mongoose transactions.
export const runtime = "nodejs";

function sha256Hex(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function localizedUrl(req: NextRequest, path: string): string {
  const origin = req.nextUrl.origin;
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
      invitation.status === "accepted" ? "already_accepted" : "invalid";
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
    const res = NextResponse.redirect(signUpUrl);
    // 15 min — enough time to complete the OAuth round-trip. sameSite=lax
    // ensures the cookie survives the top-level redirect back from WorkOS.
    res.cookies.set("gw_invite_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
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

  // Transactional accept — idempotent on duplicate membership (11000).
  const session = await mongoose.startSession();
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
        const isLead = leadOnTeamIds.some(
          (lid) => String(lid) === String(teamId),
        );
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

  // Set active workspace and redirect to dashboard.
  await setActiveWorkspace(authUser.workosUserId, String(workspaceId));

  const successRes = NextResponse.redirect(
    new URL(localizedUrl(req, "/bookings")),
  );
  // Clear the invite cookie if it was the source — single-use.
  if (clearInviteCookie) {
    successRes.cookies.set("gw_invite_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return successRes;
}
