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
import { PlusIcon, SearchIcon, MailPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeamsTable } from "./teams-table";
import { TeamDetailDrawer } from "./team-detail-drawer";
import { InviteForm } from "./invite-form";
import { DowngradeBlockModal } from "./downgrade-block-modal";
import {
  CreateDialog,
  RenameDialog,
  ColorDialog,
  DeleteDialog,
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
  plan: "free" | "starter" | "pro";
  maxTeams: number;
  maxMembersPerTeam: number;
  members: MemberSummary[];
  pendingInvites: PendingInviteRow[];
  ownerClerkUserId: string;
};

type OptimisticAction =
  | { type: "add"; team: TeamRow }
  | { type: "rename"; id: string; name: string }
  | { type: "color"; id: string; color: string }
  | { type: "delete"; id: string };

function applyOptimistic(teams: TeamRow[], action: OptimisticAction): TeamRow[] {
  switch (action.type) {
    case "add":
      return [...teams, action.team];
    case "rename":
      return teams.map((t) => (t.id === action.id ? { ...t, name: action.name } : t));
    case "color":
      return teams.map((t) => (t.id === action.id ? { ...t, color: action.color } : t));
    case "delete":
      return teams.filter((t) => t.id !== action.id);
  }
}

export function TeamsPageClient({
  teams: initialTeams,
  plan,
  maxTeams,
  maxMembersPerTeam,
  members,
  pendingInvites,
  ownerClerkUserId,
}: Props) {
  const t = useTranslations("app.teams");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [optimisticTeams, dispatch] = useOptimistic(initialTeams, applyOptimistic);

  // Search — URL-driven (?q=) with a debounced input, mirroring the clients
  // toolbar so back/forward and shared links restore the filter.
  const committedQuery = (searchParams.get("q") ?? "").trim().toLowerCase();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

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

  const filteredTeams = useMemo(
    () =>
      committedQuery
        ? optimisticTeams.filter((tm) => tm.name.toLowerCase().includes(committedQuery))
        : optimisticTeams,
    [optimisticTeams, committedQuery],
  );

  const invitableTeams: InvitableTeam[] = useMemo(
    () =>
      optimisticTeams.map((tm) => ({
        id: tm.id,
        name: tm.name,
        color: tm.color,
        memberCount: tm.memberCount,
        maxMembersPerTeam,
      })),
    [optimisticTeams, maxMembersPerTeam],
  );

  // Dialog / drawer state
  const [createOpen, setCreateOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const overCap = initialTeams.length > maxTeams;
  const [downgradeBlockOpen, setDowngradeBlockOpen] = useState(overCap);

  const [renameTeam, setRenameTeam] = useState<TeamRow | null>(null);
  const [colorTeam, setColorTeam] = useState<TeamRow | null>(null);
  const [deleteTeam, setDeleteTeam] = useState<TeamRow | null>(null);

  const [drawerTeam, setDrawerTeam] = useState<TeamRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTeamIds, setInviteTeamIds] = useState<string[]>([]);

  const atCap = optimisticTeams.length >= maxTeams;

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
        <div className="relative w-full sm:w-80">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("toolbar.search")}
            aria-label={t("toolbar.searchLabel")}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openInvite([])}>
            <MailPlus className="size-4" />
            {t("invite.button")}
          </Button>
          <Button
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={handleCreateClick}
          >
            <PlusIcon className="size-4" />
            {t("createButton")}
          </Button>
        </div>
      </div>

      {/* id is the scroll target for the DowngradeBlockModal "Manage teams" link */}
      <div id="teams-list">
        <TeamsTable
          rows={filteredTeams}
          empty={committedQuery ? t("table.empty") : t("listEmpty")}
          onDetails={openDetails}
          onRename={setRenameTeam}
          onChangeColor={setColorTeam}
          onInvite={(team) => openInvite([team.id])}
          onDelete={setDeleteTeam}
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
        ownerClerkUserId={ownerClerkUserId}
        onInvite={(team) => {
          setDrawerOpen(false);
          openInvite([team.id]);
        }}
      />

      {/* Invite dialog (shared by toolbar, table menu, and drawer) */}
      <InviteForm
        teams={invitableTeams}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        defaultTeamIds={inviteTeamIds}
      />

      {/* Create / Rename / Color / Delete dialogs */}
      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(team) => dispatch({ type: "add", team })}
        onCapExceeded={() => setUpsellOpen(true)}
      />
      {renameTeam && (
        <RenameDialog
          team={renameTeam}
          open={Boolean(renameTeam)}
          onOpenChange={(open) => !open && setRenameTeam(null)}
          onRenamed={(name) => dispatch({ type: "rename", id: renameTeam.id, name })}
        />
      )}
      {colorTeam && (
        <ColorDialog
          team={colorTeam}
          open={Boolean(colorTeam)}
          onOpenChange={(open) => !open && setColorTeam(null)}
          onColorChanged={(color) => dispatch({ type: "color", id: colorTeam.id, color })}
        />
      )}
      {deleteTeam && (
        <DeleteDialog
          team={deleteTeam}
          open={Boolean(deleteTeam)}
          onOpenChange={(open) => !open && setDeleteTeam(null)}
          onDeleted={() => dispatch({ type: "delete", id: deleteTeam.id })}
          onDeleteFailed={(restored) => dispatch({ type: "add", team: restored })}
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
          currentPlan={plan === "free" ? "starter" : (plan as "starter" | "pro")}
          targetPlan={plan === "pro" ? "starter" : "free"}
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
