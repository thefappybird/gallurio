import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import {
  Team,
  TeamMembership,
  User,
  Invitation,
  type TeamDoc,
  type TeamMembershipDoc,
  type UserDoc,
  type InvitationDoc,
} from "@/lib/db/models";
import { planEntitlements } from "@/lib/plans/entitlements";
import { TeamsPageClient } from "./_components/teams-page-client";
import { MemberTeamsView } from "./_components/MemberTeamsView";
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

  const { role, workspace, userId } = await requireOrg();

  // Staff members see only their own team memberships.
  // MemberTeamsView handles its own connectDB() call.
  if (role !== "owner") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <MemberTeamsView
          workosUserId={userId}
          workspaceId={String(workspace._id)}
        />
      </div>
    );
  }

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

  const members: MemberSummary[] = memberUsers.map((u) => ({
    workosUserId: u.workosUserId,
    email: u.email,
    name: u.name ?? "",
    avatarUrl: u.avatarUrl ?? null,
    teams: membershipsByUser.get(u.workosUserId) ?? [],
  }));

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
      />
    </div>
  );
}
