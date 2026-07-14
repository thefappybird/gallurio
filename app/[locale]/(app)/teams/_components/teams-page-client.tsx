"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { PlusIcon, SearchIcon, MailPlusIcon, UsersRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TeamsTable } from "./teams-table";
import { TeamDetailDrawer } from "./team-detail-drawer";
import { ViewMembersSidebar } from "./view-members-sidebar";
import { InviteForm } from "./invite-form";
import { DowngradeBlockModal } from "./downgrade-block-modal";
import {
  CreateDialog,
  EditDialog,
  DeactivateDialog,
  ReactivateDialog,
  UpsellDialog,
} from "./team-dialogs";
import type {
  InvitableTeam,
  MemberSummary,
  PendingInviteRow,
  TeamRow,
} from "../_types";

type Props = {
  teams: TeamRow[];
  plan: "free" | "pro" | "beta";
  maxTeams: number;
  maxMembersPerTeam: number;
  members: MemberSummary[];
  pendingInvites: PendingInviteRow[];
  ownerWorkosUserId: string;
  workspaceId: string;
  canManage: boolean;
};

type OptimisticAction =
  | { type: "add"; team: TeamRow }
  | { type: "rename"; id: string; name: string }
  | { type: "color"; id: string; color: string }
  | { type: "deactivate"; id: string }
  | { type: "reactivate"; id: string };

function applyOptimistic(teams: TeamRow[], action: OptimisticAction): TeamRow[] {
  switch (action.type) {
    case "add":
      return [...teams, action.team];
    case "rename":
      return teams.map((t) => (t.id === action.id ? { ...t, name: action.name } : t));
    case "color":
      return teams.map((t) => (t.id === action.id ? { ...t, color: action.color } : t));
    case "deactivate":
      return teams.map((t) => (t.id === action.id ? { ...t, isActive: false } : t));
    case "reactivate":
      return teams.map((t) => (t.id === action.id ? { ...t, isActive: true } : t));
  }
}

export function TeamsPageClient({
  teams: initialTeams,
  plan,
  maxTeams,
  maxMembersPerTeam,
  members,
  pendingInvites,
  ownerWorkosUserId,
  workspaceId,
  canManage,
}: Props) {
  const t = useTranslations("app.teams");
  // Covers team.invitation/removed/deleted; member-add and lead-toggle aren't
  // covered since no notification type exists for them yet.
  useLiveRefresh(["team"]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // A create/edit/deactivate/reactivate dialog's onDone triggers this after
  // its own optimistic update has already landed, so the table is already
  // showing the correct row — this just reconciles server data silently in
  // the background (no skeleton; that would just flash over data that's
  // already right).
  const [, startRefreshTransition] = useTransition();

  const [optimisticTeams, dispatch] = useOptimistic(initialTeams, applyOptimistic);

  function refreshTeams() {
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  // Search — URL-driven (?q=) with a debounced input, mirroring the clients
  // toolbar so back/forward and shared links restore the filter.
  const committedQuery = (searchParams.get("q") ?? "").trim().toLowerCase();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [showDeactivated, setShowDeactivated] = useState(false);

  useEffect(() => {
    const next = searchParams.get("q") ?? "";
    Promise.resolve().then(() => setQ(next));
  }, [searchParams]);

  const pushQuery = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => pushQuery(q), 250);
    return () => clearTimeout(id);
  }, [q, searchParams, pushQuery]);

  const filteredTeams = useMemo(() => {
    let teams = showDeactivated ? optimisticTeams : optimisticTeams.filter((tm) => tm.isActive);
    if (committedQuery) {
      teams = teams.filter((tm) => tm.name.toLowerCase().includes(committedQuery));
    }
    return teams;
  }, [optimisticTeams, committedQuery, showDeactivated]);

  const invitableTeams: InvitableTeam[] = useMemo(
    () =>
      optimisticTeams
        .filter((tm) => tm.isActive)
        .map((tm) => ({
          id: tm.id,
          name: tm.name,
          color: tm.color,
          memberCount: tm.memberCount,
          maxMembersPerTeam,
          hasLead:
            members.some((member) =>
              member.teams.some((team) => team.teamId === tm.id && team.role === "lead"),
            ) ||
            pendingInvites.some((invite) => invite.leadOnTeamIds.includes(tm.id)),
        })),
    [optimisticTeams, maxMembersPerTeam, members, pendingInvites],
  );

  // Dialog / drawer state
  const [createOpen, setCreateOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const activeTeamCount = initialTeams.filter((t) => t.isActive).length;
  const overCap = activeTeamCount > maxTeams;
  const [downgradeBlockOpen, setDowngradeBlockOpen] = useState(overCap);

  const [editTeam, setEditTeam] = useState<TeamRow | null>(null);
  const [deactivateTeam, setDeactivateTeam] = useState<TeamRow | null>(null);
  const [reactivateTeam, setReactivateTeam] = useState<TeamRow | null>(null);

  const [drawerTeam, setDrawerTeam] = useState<TeamRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTeamIds, setInviteTeamIds] = useState<string[]>([]);
  const [viewMembersOpen, setViewMembersOpen] = useState(false);

  const atCap = optimisticTeams.filter((t) => t.isActive).length >= maxTeams;

  const handleCreateClick = useCallback(() => {
    if (atCap) setUpsellOpen(true);
    else setCreateOpen(true);
  }, [atCap]);

  const openInvite = useCallback((teamIds: string[]) => {
    setInviteTeamIds(teamIds);
    setInviteOpen(true);
  }, []);

  const openDetails = useCallback((team: TeamRow) => {
    setDrawerTeam(team);
    setDrawerOpen(true);
  }, []);

  // Keep the open drawer's team object in sync with refreshed server data so
  // member counts / colors shown in the header stay current after a mutation.
  const liveDrawerTeam = drawerTeam
    ? (optimisticTeams.find((tm) => tm.id === drawerTeam.id) ?? drawerTeam)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("description")}</p>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative w-full sm:w-80">
            <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("toolbar.search")}
              aria-label={t("toolbar.searchLabel")}
              className="ps-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-deactivated"
              checked={showDeactivated}
              onCheckedChange={setShowDeactivated}
              aria-label={t("toolbar.showDeactivated")}
            />
            <Label htmlFor="show-deactivated" className="cursor-pointer text-sm text-muted-foreground">
              {t("toolbar.showDeactivated")}
            </Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setViewMembersOpen(true)}>
            <UsersRoundIcon className="size-4" />
            {t("members.viewButton")}
          </Button>
          {canManage && (
            <Button variant="outline" onClick={() => openInvite([])}>
              <MailPlusIcon className="size-4" />
              {t("invite.button")}
            </Button>
          )}
          {canManage && (
            <Button
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={handleCreateClick}
            >
              <PlusIcon className="size-4" />
              {t("createButton")}
            </Button>
          )}
        </div>
      </div>

      {/* id is the scroll target for the DowngradeBlockModal "Manage teams" link */}
      <div id="teams-list">
        <TeamsTable
          rows={filteredTeams}
          empty={committedQuery ? t("table.empty") : t("listEmpty")}
          emptyAction={
            committedQuery ? undefined : (
              <Button
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                onClick={handleCreateClick}
              >
                <PlusIcon className="size-4" />
                {t("createButton")}
              </Button>
            )
          }
          onDetails={openDetails}
          onEdit={setEditTeam}
          onInvite={(team) => openInvite([team.id])}
          onDeactivate={setDeactivateTeam}
          onReactivate={setReactivateTeam}
          canManage={canManage}
        />
      </div>

      {/* Detail drawer */}
      <TeamDetailDrawer
        team={liveDrawerTeam}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        members={members}
        pendingInvites={pendingInvites}
        maxMembersPerTeam={maxMembersPerTeam}
        ownerWorkosUserId={ownerWorkosUserId}
        workspaceId={workspaceId}
        canManage={canManage}
        onInvite={(team) => {
          setDrawerOpen(false);
          openInvite([team.id]);
        }}
      />

      {/* Workspace-wide member list (view-only unless canManage) */}
      <ViewMembersSidebar
        members={members}
        teams={optimisticTeams}
        ownerWorkosUserId={ownerWorkosUserId}
        workspaceId={workspaceId}
        canManage={canManage}
        open={viewMembersOpen}
        onOpenChange={setViewMembersOpen}
      />

      {/* Invite dialog (shared by toolbar, table menu, and drawer) */}
      <InviteForm
        teams={invitableTeams}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        defaultTeamIds={inviteTeamIds}
        onDone={refreshTeams}
      />

      {/* Create / Rename / Color / Delete dialogs */}
      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(team) => dispatch({ type: "add", team })}
        onCapExceeded={() => setUpsellOpen(true)}
        onDone={refreshTeams}
      />
      {editTeam && (
        <EditDialog
          team={editTeam}
          open={Boolean(editTeam)}
          onOpenChange={(open) => !open && setEditTeam(null)}
          onRenamed={(name) => dispatch({ type: "rename", id: editTeam.id, name })}
          onColorChanged={(color) => dispatch({ type: "color", id: editTeam.id, color })}
          onDone={refreshTeams}
        />
      )}
      {deactivateTeam && (
        <DeactivateDialog
          team={deactivateTeam}
          open={Boolean(deactivateTeam)}
          onOpenChange={(open) => !open && setDeactivateTeam(null)}
          onDeactivated={() => dispatch({ type: "deactivate", id: deactivateTeam.id })}
          onFailed={(restored) =>
            dispatch({ type: "reactivate", id: restored.id })
          }
          onDone={refreshTeams}
        />
      )}
      {reactivateTeam && (
        <ReactivateDialog
          team={reactivateTeam}
          open={Boolean(reactivateTeam)}
          onOpenChange={(open) => !open && setReactivateTeam(null)}
          onReactivated={() => dispatch({ type: "reactivate", id: reactivateTeam.id })}
          onFailed={(restored) =>
            dispatch({ type: "deactivate", id: restored.id })
          }
          onDone={refreshTeams}
        />
      )}

      <UpsellDialog
        open={upsellOpen}
        onOpenChange={setUpsellOpen}
        plan={plan}
        maxTeams={maxTeams}
      />

      {overCap && (
        <DowngradeBlockModal
          open={downgradeBlockOpen}
          onOpenChange={setDowngradeBlockOpen}
          currentPlan="pro"
          targetPlan="free"
          currentTeamCount={initialTeams.length}
          maxTeamsOnTargetPlan={maxTeams}
          teamsToReview={initialTeams.map((tm) => ({
            id: tm.id,
            name: tm.name,
            color: tm.color,
            isDefault: tm.isDefault,
          }))}
        />
      )}
    </div>
  );
}
