export type TeamRow = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  memberCount: number;
};

export type TeamMemberRole = "member" | "lead";

export type MemberSummary = {
  clerkUserId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  teams: { teamId: string; role: TeamMemberRole }[];
};

export type PendingInviteRow = {
  email: string;
  teamIds: string[];
  leadOnTeamIds: string[];
  invitedAt: string;
};

// A team enriched with the seat ceiling so cap checks can run in the UI without
// re-deriving the plan entitlement per render.
export type InvitableTeam = {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  maxMembersPerTeam: number;
};
