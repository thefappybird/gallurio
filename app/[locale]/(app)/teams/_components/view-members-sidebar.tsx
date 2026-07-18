"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { EyeIcon, Loader2Icon, MailIcon, MailPlusIcon, MailXIcon, UserMinusIcon, UsersRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { useRouter } from "@/lib/i18n/navigation";
import { revokeInviteAction } from "../_invite-action";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RemoveMemberDialog, type RemoveMemberTarget } from "./remove-member-dialog";
import { MemberDetailsDialog } from "./member-details-dialog";
import type { MemberSummary, PendingInviteRow, TeamRow } from "../_types";

type Props = {
  members: MemberSummary[];
  pendingInvites: PendingInviteRow[];
  teams: TeamRow[];
  ownerWorkosUserId: string;
  workspaceId: string;
  canManage: boolean;
  onInvite?: () => void;
  initialMode?: MembersMode;
  initialActiveQuery?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function displayName(m: MemberSummary): string {
  return m.name || m.email;
}

const PAGE_SIZE = 10;
type MembersMode = "active" | "pending";

function teamTextColor(color: string): "#ffffff" | "#1a1a1a" {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return "#ffffff";
  const channels = match.slice(1).map((channel) => parseInt(channel, 16) / 255);
  const linearize = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const [red, green, blue] = channels.map(linearize);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.5 ? "#1a1a1a" : "#ffffff";
}

function TeamPill({ team }: { team: TeamRow }) {
  return (
    <span
      className="inline-flex max-w-full items-center truncate border px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: team.color, borderColor: team.color, color: teamTextColor(team.color) }}
    >
      <span className="truncate">{team.name}</span>
    </span>
  );
}

export function ViewMembersSidebar({
  members,
  pendingInvites,
  teams,
  ownerWorkosUserId,
  workspaceId: _workspaceId,
  canManage,
  onInvite,
  initialMode = "active",
  initialActiveQuery = "",
  open,
  onOpenChange,
}: Props) {
  const t = useTranslations("app.teams");
  const tp = useTranslations("common.pagination");
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = useState<RemoveMemberTarget | null>(null);
  const [detailMember, setDetailMember] = useState<MemberSummary | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [mode, setMode] = useState<MembersMode>(initialMode);
  const [activeQuery, setActiveQuery] = useState(initialActiveQuery);
  const [pendingQuery, setPendingQuery] = useState("");
  const [activePage, setActivePage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [, startTransition] = useTransition();

  const activeMembers = useMemo(() => {
    const query = activeQuery.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) =>
      `${member.name} ${member.email}`.toLowerCase().includes(query),
    );
  }, [activeQuery, members]);

  const filteredPendingInvites = useMemo(() => {
    const query = pendingQuery.trim().toLowerCase();
    if (!query) return pendingInvites;
    return pendingInvites.filter((invite) => invite.email.toLowerCase().includes(query));
  }, [pendingInvites, pendingQuery]);

  const visibleRows = mode === "active" ? activeMembers : filteredPendingInvites;
  const savedPage = mode === "active" ? activePage : pendingPage;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const page = Math.min(savedPage, totalPages);
  const paginatedRows = visibleRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = visibleRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, visibleRows.length);

  function teamById(teamId: string): TeamRow | undefined {
    return teams.find((tm) => tm.id === teamId);
  }

  function setPage(next: number) {
    if (mode === "active") setActivePage(next);
    else setPendingPage(next);
  }

  function handleModeChange(next: MembersMode) {
    if (next === mode) return;
    // Search is deliberately transient: returning to either list starts with
    // its complete local dataset, while each list retains its last page.
    setActiveQuery("");
    setPendingQuery("");
    setMode(next);
  }

  function handleSearchChange(value: string) {
    if (mode === "active") {
      setActiveQuery(value);
      setActivePage(1);
    } else {
      setPendingQuery(value);
      setPendingPage(1);
    }
  }

  function handleRevoke(invitationId: string) {
    setRevokingInviteId(invitationId);
    startTransition(async () => {
      const result = await revokeInviteAction({ invitationId });
      setRevokingInviteId(null);
      if (result.error) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("invite.toasts.revoked"));
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 overflow-hidden sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t("members.heading")}</SheetTitle>
          <SheetDescription>{t("members.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-b border-border bg-popover p-4">
            <SegmentedToggle
              value={mode}
              onChange={handleModeChange}
              ariaLabel={t("members.modeLabel")}
              options={[
                { key: "active", label: t("members.active"), icon: UsersRoundIcon },
                { key: "pending", label: t("members.pending"), icon: MailIcon },
              ]}
            />
            <div className="flex items-center gap-2">
              <Input
                type="search"
                value={mode === "active" ? activeQuery : pendingQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={t("members.searchPlaceholder")}
                aria-label={t("members.searchPlaceholder")}
              />
              {mode === "pending" && canManage && onInvite && (
                <Button type="button" variant="outline" size="sm" onClick={onInvite}>
                  <MailPlusIcon className="size-4" />
                  {t("invite.button")}
                </Button>
              )}
            </div>
          </div>

          {mode === "active" && (activeMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {activeQuery.trim() ? t("members.noActiveMatches") : t("members.empty")}
            </p>
          ) : (
            <ul className="flex flex-col border border-border bg-card">
              {paginatedRows.map((m) => {
                if (!("workosUserId" in m)) return null;
                const isOwner = m.workosUserId === ownerWorkosUserId;
                return (
                  <li
                  key={m.workosUserId}
                  className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {displayName(m)}
                      {isOwner && (
                        <Badge variant="secondary" className="text-xs">
                          {t("members.ownerBadge")}
                        </Badge>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isOwner ? (
                        <span className="text-xs text-muted-foreground">
                          {t("members.ownerAllTeams")}
                        </span>
                      ) : m.teams.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("members.noTeams")}
                        </span>
                      ) : (
                        (() => {
                          const memberTeams = m.teams
                            .map((membership) => teamById(membership.teamId))
                            .filter((team): team is TeamRow => Boolean(team));
                          return (
                            <>
                              {memberTeams.slice(0, 3).map((team) => (
                                <TeamPill key={team.id} team={team} />
                              ))}
                            </>
                          );
                        })()
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      aria-label={`View ${displayName(m)}`}
                      title={`View ${displayName(m)}`}
                      onClick={() => setDetailMember(m)}
                    >
                      <EyeIcon className="size-4" />
                    </Button>
                    {canManage && !isOwner && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={m.teams.some((membership) => membership.role === "lead")}
                        aria-label={t("members.removeFromWorkspaceLabel", { name: displayName(m) })}
                        title={m.teams.some((membership) => membership.role === "lead")
                          ? t("members.errors.isTeamLead", { name: displayName(m) })
                          : t("members.removeFromWorkspaceLabel", { name: displayName(m) })}
                        onClick={() => setRemoveTarget({
                          workosUserId: m.workosUserId,
                          name: m.name,
                          email: m.email,
                          teams: m.teams,
                        })}
                      >
                        <UserMinusIcon className="size-4" />
                      </Button>
                    )}
                  </div>
                  </li>
                );
              })}
            </ul>
          ))}

          {mode === "pending" && (filteredPendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {pendingQuery.trim() ? t("members.noPendingMatches") : t("members.noPending")}
            </p>
          ) : (
              <ul className="flex flex-col border border-border bg-card">
                {paginatedRows.map((invite) => {
                  if (!("invitationId" in invite)) return null;
                  const busy = revokingInviteId === invite.invitationId;
                  return (
                    <li
                      key={invite.invitationId}
                      className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-sm text-muted-foreground">{invite.email}</span>
                        <Badge variant="outline" className="text-xs">
                          {t("members.pendingBadge")}
                        </Badge>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          disabled={busy}
                          aria-label={t("members.revokeInvite")}
                          onClick={() => handleRevoke(invite.invitationId)}
                        >
                          {busy ? (
                            <Loader2Icon className="size-4 animate-spin" />
                          ) : (
                            <MailXIcon className="size-4" />
                          )}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
          ))}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-background p-4">
          <span className="text-xs text-muted-foreground">
            {tp("showing", { from, to, total: visibleRows.length })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              {tp("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              {tp("next")}
            </Button>
          </div>
        </footer>
      </SheetContent>

      <RemoveMemberDialog
        mode="workspace"
        member={removeTarget}
        open={Boolean(removeTarget)}
        onOpenChange={(next) => !next && setRemoveTarget(null)}
      />
      <MemberDetailsDialog member={detailMember} teams={teams} ownerWorkosUserId={ownerWorkosUserId} open={Boolean(detailMember)} onOpenChange={(next) => !next && setDetailMember(null)} />
    </Sheet>
  );
}
