import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import {
  Team,
  Booking,
  TeamMembership,
  User,
  Invitation,
  type TeamDoc,
  type TeamMembershipDoc,
  type UserDoc,
  type InvitationDoc,
} from "@/lib/db/models";
import { planEntitlements } from "@/lib/plans/entitlements";
import { resolveWorkspaceTimezone } from "@/lib/utils/timezone";
import { TeamsPageClient } from "./_components/teams-page-client";
import type { MemberSummary, PendingInviteRow, TeamRow } from "./_types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.teams");
  return { title: t("title") };
}

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.teams");

  const { role, workspace } = await requireOrg();

  await connectDB();

  const rawTeams = await Team.find({ workspaceId: workspace._id })
    .sort({ isActive: -1, isDefault: -1, createdAt: 1 })
    .lean<TeamDoc[]>();

  // A month is bucketed in the workspace's timezone. Drafts are inquiry
  // placeholders rather than confirmed bookings, so they do not affect this
  // team activity metric.
  const monthlyBookingRows = await Booking.aggregate<{
    _id: { toString(): string };
    average: number;
  }>([
    {
      $match: {
        workspaceId: workspace._id,
        teamId: { $ne: null },
        status: { $ne: "draft" },
      },
    },
    {
      $group: {
        _id: {
          teamId: "$teamId",
          month: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
              timezone: resolveWorkspaceTimezone(workspace),
            },
          },
        },
        bookings: { $sum: 1 },
      },
    },
    { $group: { _id: "$_id.teamId", average: { $avg: "$bookings" } } },
  ]);
  const monthlyAverageByTeam = new Map(
    monthlyBookingRows.map((row) => [
      String(row._id),
      Math.round(row.average * 10) / 10,
    ]),
  );

  const teams: TeamRow[] = rawTeams.map((tm) => ({
    id: String(tm._id),
    name: tm.name,
    color: tm.color,
    isDefault: tm.isDefault ?? false,
    isActive: tm.isActive ?? true,
    memberCount: tm.memberCount ?? 0,
    monthlyAverage: monthlyAverageByTeam.get(String(tm._id)) ?? 0,
  }));

  const { maxTeams, maxMembersPerTeam } = planEntitlements(
    workspace.plan as "free" | "pro" | "beta",
  );

  const [memberUsers, memberships, rawPendingInvites] = await Promise.all([
    User.find({ "memberships.workspaceId": workspace._id })
      .select({ workosUserId: 1, email: 1, name: 1, avatarUrl: 1 })
      .lean<UserDoc[]>(),
    TeamMembership.find({ workspaceId: workspace._id })
      .select({ workosUserId: 1, teamId: 1, role: 1 })
      .lean<TeamMembershipDoc[]>(),
    Invitation.find({ workspaceId: workspace._id, status: "pending" })
      .sort({ createdAt: -1 })
      .lean<InvitationDoc[]>(),
  ]);

  const membershipsByUser = new Map<
    string,
    { teamId: string; role: "member" | "lead" }[]
  >();
  for (const m of memberships) {
    const uid = m.workosUserId;
    const list = membershipsByUser.get(uid) ?? [];
    list.push({
      teamId: String(m.teamId),
      role: (m.role ?? "member") as "member" | "lead",
    });
    membershipsByUser.set(uid, list);
  }

  const teamIds = rawTeams.map((team) => team._id);
  const now = new Date();
  const bookingStatsByTeam = new Map(
    (await Booking.aggregate<{
      _id: { toString(): string };
      completed: number;
      active: number;
      future: number;
    }>([
      { $match: { workspaceId: workspace._id, teamId: { $in: teamIds } } },
      {
        $group: {
          _id: "$teamId",
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          active: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "booked"] }, { $lte: ["$firstSessionStart", now] }, { $gte: ["$lastSessionEnd", now] }] }, 1, 0] } },
          future: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "booked"] }, { $gt: ["$firstSessionStart", now] }] }, 1, 0] } },
        },
      },
    ])).map((row) => [String(row._id), row]),
  );

  const members: MemberSummary[] = memberUsers.map((u) => {
    const memberTeams = membershipsByUser.get(u.workosUserId) ?? [];
    const bookingStats = memberTeams.reduce(
      (totals, membership) => {
        const teamStats = bookingStatsByTeam.get(membership.teamId);
        return {
          completed: totals.completed + (teamStats?.completed ?? 0),
          active: totals.active + (teamStats?.active ?? 0),
          future: totals.future + (teamStats?.future ?? 0),
        };
      },
      { completed: 0, active: 0, future: 0 },
    );
    return {
    workosUserId: u.workosUserId,
    email: u.email,
    name: u.name ?? "",
    avatarUrl: u.avatarUrl ?? null,
    teams: memberTeams,
    bookingStats,
  };
  });

  const pendingInvites: PendingInviteRow[] = rawPendingInvites.map((p) => ({
    invitationId: String(p._id),
    email: p.email,
    teamIds: (p.teamIds ?? []).map((id) => String(id)),
    leadOnTeamIds: (p.leadOnTeamIds ?? []).map((id) => String(id)),
    invitedAt: (p as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? "",
    expiresAt: p.expiresAt instanceof Date ? p.expiresAt.toISOString() : String(p.expiresAt),
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <TeamsPageClient
        teams={teams}
        plan={workspace.plan as "free" | "pro" | "beta"}
        maxTeams={maxTeams}
        maxMembersPerTeam={maxMembersPerTeam}
        members={members}
        pendingInvites={pendingInvites}
        ownerWorkosUserId={workspace.ownerUserId}
        canManage={role === "owner"}
        workspaceId={String(workspace._id)}
      />
    </div>
  );
}
