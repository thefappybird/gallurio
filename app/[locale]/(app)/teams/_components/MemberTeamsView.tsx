import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Team, TeamMembership, type TeamDoc } from "@/lib/db/models";

type Props = {
  workosUserId: string;
  workspaceId: string;
};

type TeamRow = {
  id: string;
  name: string;
  color: string;
  role: "member" | "lead";
  memberCount: number;
};

// TODO i18n — labels below use hardcoded English; wire up app.teams.memberView.* keys when added to locale files.
export async function MemberTeamsView({ workosUserId, workspaceId }: Props) {
  await connectDB();

  const memberships = await TeamMembership.find({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    workosUserId,
  })
    .select({ teamId: 1, role: 1 })
    .lean<{ teamId: mongoose.Types.ObjectId; role?: string }[]>();

  if (memberships.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        You are not a member of any team.
      </p>
    );
  }

  const teamIds = memberships.map((m) => m.teamId);
  const roleByTeamId = new Map(
    memberships.map((m) => [String(m.teamId), (m.role ?? "member") as "member" | "lead"]),
  );

  const rawTeams = await Team.find({
    _id: { $in: teamIds },
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
  })
    .select({ name: 1, color: 1, memberCount: 1 })
    .lean<(Pick<TeamDoc, "name" | "color" | "memberCount"> & { _id: mongoose.Types.ObjectId })[]>();

  const rows: TeamRow[] = rawTeams.map((t) => ({
    id: String(t._id),
    name: t.name,
    color: t.color,
    role: roleByTeamId.get(String(t._id)) ?? "member",
    memberCount: t.memberCount ?? 0,
  }));

  // Sort alphabetically for a stable, predictable order.
  rows.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((team) => (
        <div
          key={team.id}
          className="flex min-w-0 items-center gap-3 border border-border bg-card px-4 py-3"
        >
          {/* Color swatch */}
          <span
            className="size-3 shrink-0"
            style={{ backgroundColor: team.color }}
            aria-hidden
          />

          {/* Team name */}
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-card-foreground">
            {team.name}
          </span>

          {/* Member count */}
          <span className="shrink-0 text-xs text-muted-foreground">
            {team.memberCount === 1
              ? "1 member"
              : `${team.memberCount} members`}
          </span>

          {/* Role badge */}
          <span className="shrink-0 border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {team.role === "lead" ? "Lead" : "Member"}
          </span>
        </div>
      ))}
    </div>
  );
}
