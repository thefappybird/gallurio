import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import {
  Team,
  TeamMembership,
  User,
  PendingTeamAssignment,
  type TeamDoc,
  type TeamMembershipDoc,
  type UserDoc,
  type PendingTeamAssignmentDoc,
} from "@/lib/db/models";
import { planEntitlements } from "@/lib/plans/entitlements";
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
  // Teams management is owner-only; members never see the nav link, and a
  // direct URL hit must 404 rather than leak the workspace roster.
  if (role !== "owner") notFound();

  await connectDB();

  const rawTeams = await Team.find({ workspaceId: workspace._id })
    .sort({ isActive: -1, isDefault: -1, createdAt: 1 })
    .lean<TeamDoc[]>();

  const teams: TeamRow[] = rawTeams.map((tm) => ({
    id: String(tm._id),
    name: tm.name,
    color: tm.color,
    isDefault: tm.isDefault ?? false,
    isActive: tm.isActive ?? true,
    memberCount: tm.memberCount ?? 0,
  }));

  const { maxTeams, maxMembersPerTeam } = planEntitlements(
    workspace.plan as "free" | "starter" | "pro",
  );

  const [memberUsers, memberships, pendingInviteRows] = await Promise.all([
    User.find({ "memberships.workspaceId": workspace._id })
      .select({ clerkUserId: 1, email: 1, name: 1, avatarUrl: 1 })
      .lean<UserDoc[]>(),
    TeamMembership.find({ workspaceId: workspace._id })
      .select({ clerkUserId: 1, teamId: 1, role: 1 })
      .lean<TeamMembershipDoc[]>(),
    PendingTeamAssignment.find({ workspaceId: workspace._id })
      .sort({ createdAt: -1 })
      .lean<PendingTeamAssignmentDoc[]>(),
  ]);

  const membershipsByUser = new Map<
    string,
    { teamId: string; role: "member" | "lead" }[]
  >();
  for (const m of memberships) {
    const list = membershipsByUser.get(m.clerkUserId) ?? [];
    list.push({
      teamId: String(m.teamId),
      role: (m.role ?? "member") as "member" | "lead",
    });
    membershipsByUser.set(m.clerkUserId, list);
  }

  const members: MemberSummary[] = memberUsers.map((u) => ({
    clerkUserId: u.clerkUserId,
    email: u.email,
    name: u.name ?? "",
    avatarUrl: u.avatarUrl ?? null,
    teams: membershipsByUser.get(u.clerkUserId) ?? [],
  }));

  const pendingInvites: PendingInviteRow[] = pendingInviteRows.map((p) => ({
    email: p.email,
    teamIds: (p.teamIds ?? []).map((id) => String(id)),
    leadOnTeamIds: (p.leadOnTeamIds ?? []).map((id) => String(id)),
    invitedAt: (p as { createdAt?: Date }).createdAt?.toISOString() ?? "",
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <TeamsPageClient
        teams={teams}
        plan={workspace.plan as "free" | "starter" | "pro"}
        maxTeams={maxTeams}
        maxMembersPerTeam={maxMembersPerTeam}
        members={members}
        pendingInvites={pendingInvites}
        ownerClerkUserId={workspace.ownerUserId}
      />
    </div>
  );
}
