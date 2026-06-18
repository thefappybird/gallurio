"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Loader2Icon, MailPlusIcon, MailXIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignMemberToTeamAction,
  removeMemberFromTeamAction,
  setLeadFlagAction,
} from "../_member-action";
import { revokeInviteAction } from "../_invite-action";
import type { MemberSummary, PendingInviteRow, TeamRow } from "../_types";

type Props = {
  team: TeamRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberSummary[];
  pendingInvites: PendingInviteRow[];
  maxMembersPerTeam: number;
  ownerWorkosUserId: string;
  onInvite: (team: TeamRow) => void;
};

function displayName(m: MemberSummary): string {
  return m.name || m.email;
}

export function TeamDetailDrawer({
  team,
  open,
  onOpenChange,
  members,
  pendingInvites,
  maxMembersPerTeam,
  ownerWorkosUserId,
  onInvite,
}: Props) {
  const t = useTranslations("app.teams");
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");
  const [leadWarnFor, setLeadWarnFor] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!team) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const teamId = team.id;
  const teamMembers = members.filter((m) =>
    m.teams.some((tm) => tm.teamId === teamId),
  );
  const assignable = members.filter(
    (m) =>
      m.workosUserId !== ownerWorkosUserId &&
      !m.teams.some((tm) => tm.teamId === teamId),
  );
  const teamPending = pendingInvites.filter((p) => p.teamIds.includes(teamId));
  const atCap = team.memberCount >= maxMembersPerTeam;

  function roleOf(m: MemberSummary): "member" | "lead" {
    return m.teams.find((tm) => tm.teamId === teamId)?.role ?? "member";
  }

  // A team may have at most one lead. Once one exists, every other member's lead
  // toggle is disabled; clicking it surfaces a validation popover instead.
  const teamHasLead = teamMembers.some((m) => roleOf(m) === "lead");

  function handleAdd(workosUserId: string) {
    if (!workosUserId) return;
    setBusyId(workosUserId);
    startTransition(async () => {
      const result = await assignMemberToTeamAction({ workosUserId, teamId, role: "member" });
      setBusyId(null);
      setAddValue("");
      if (result.error) {
        toast.error(
          result.error === "TEAM_SEAT_CAP_EXCEEDED"
            ? t("drawer.teamFull")
            : result.error === "ALREADY_ON_TEAM"
              ? t("assignment.errors.alreadyOnTeam")
              : t("errors.generic"),
        );
        return;
      }
      toast.success(t("assignment.toasts.added"));
      router.refresh();
    });
  }

  function handleRemove(workosUserId: string) {
    setBusyId(workosUserId);
    startTransition(async () => {
      const result = await removeMemberFromTeamAction({ workosUserId, teamId });
      setBusyId(null);
      if (result.error) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("assignment.toasts.removed"));
      router.refresh();
    });
  }

  function handleSetLead(workosUserId: string, isLead: boolean) {
    setBusyId(workosUserId);
    startTransition(async () => {
      const result = await setLeadFlagAction({ workosUserId, teamId, isLead });
      setBusyId(null);
      if (result.error) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(
        isLead ? t("assignment.toasts.promoted") : t("assignment.toasts.demoted"),
      );
      router.refresh();
    });
  }

  function handleRevoke(invitationId: string) {
    setBusyId(invitationId);
    startTransition(async () => {
      const result = await revokeInviteAction({ invitationId });
      setBusyId(null);
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
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-4 shrink-0 border border-border"
              style={{ backgroundColor: team.color }}
            />
            <span className="truncate">{team.name}</span>
            {team.isDefault && (
              <Badge variant="secondary" className="text-xs">
                {t("team.defaultBadge")}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {t("drawer.memberCount", { count: team.memberCount, max: maxMembersPerTeam })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-4">
          {/* Members on this team */}
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("drawer.membersHeading")}
            </h3>
            {teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("drawer.noMembers")}</p>
            ) : (
              <ul className="flex flex-col border border-border bg-card">
                {teamMembers.map((m) => {
                  const isOwner = m.workosUserId === ownerWorkosUserId;
                  const isLead = roleOf(m) === "lead";
                  const blocked = teamHasLead && !isLead;
                  const busy = busyId === m.workosUserId;
                  return (
                    <li
                      key={m.workosUserId}
                      className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {displayName(m)}
                          {isOwner && (
                            <Badge variant="secondary" className="text-xs">
                              {t("members.ownerBadge")}
                            </Badge>
                          )}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {m.email}
                        </span>
                      </div>
                      {!isOwner && (
                        <div className="flex shrink-0 items-center gap-3">
                          <Label
                            htmlFor={`lead-${m.workosUserId}`}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground"
                          >
                            {t("drawer.leadToggleLabel")}
                            {blocked ? (
                              // Lead already taken: render a disabled-looking
                              // switch that, instead of toggling, surfaces a
                              // validation popup just above it. A real button with
                              // aria-disabled keeps it keyboard-focusable and
                              // announces the disabled state (color is not the only
                              // signal). It mirrors the Switch's off-state styles.
                              <span className="relative inline-flex">
                                <button
                                  type="button"
                                  id={`lead-${m.workosUserId}`}
                                  role="switch"
                                  aria-checked={false}
                                  aria-disabled
                                  aria-label={t("drawer.leadToggleLabel")}
                                  onClick={() =>
                                    setLeadWarnFor((cur) =>
                                      cur === m.workosUserId
                                        ? null
                                        : m.workosUserId,
                                    )
                                  }
                                  onBlur={() => setLeadWarnFor(null)}
                                  className="inline-flex h-5 w-9 shrink-0 cursor-not-allowed items-center border border-input bg-input opacity-50 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                                >
                                  <span className="pointer-events-none block size-4 translate-x-0 bg-background" />
                                </button>
                                {leadWarnFor === m.workosUserId && (
                                  <span
                                    role="alert"
                                    className="absolute bottom-full right-0 z-50 mb-2 w-48 border border-destructive bg-popover p-2 text-xs leading-snug text-destructive shadow-md"
                                  >
                                    {t("drawer.leadOnlyOnePerTeam")}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <Switch
                                id={`lead-${m.workosUserId}`}
                                checked={isLead}
                                disabled={busy}
                                onCheckedChange={(v) =>
                                  handleSetLead(m.workosUserId, v)
                                }
                              />
                            )}
                          </Label>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleRemove(m.workosUserId)}
                          >
                            {busy ? (
                              <Loader2Icon className="size-4 animate-spin" />
                            ) : (
                              t("drawer.removeFromTeam")
                            )}
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Add an existing workspace member */}
          <section className="flex flex-col gap-2">
            <Label htmlFor="add-member-select">{t("drawer.addMemberLabel")}</Label>
            {assignable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("drawer.noAssignableMembers")}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Select<string>
                  value={addValue}
                  onValueChange={(v) => {
                    setAddValue(v ?? "");
                    if (v) handleAdd(v);
                  }}
                  disabled={atCap || busyId !== null}
                >
                  <SelectTrigger id="add-member-select" className="flex-1">
                    <SelectValue>
                      {(value: string) => {
                        const m = assignable.find((x) => x.workosUserId === value);
                        return m ? (
                          <span className="truncate">{displayName(m)}</span>
                        ) : (
                          <span className="text-muted-foreground">
                            {t("drawer.addMemberPlaceholder")}
                          </span>
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {assignable.map((m) => (
                      <SelectItem key={m.workosUserId} value={m.workosUserId}>
                        <span className="flex flex-col">
                          <span className="text-sm">{displayName(m)}</span>
                          <span className="text-xs text-muted-foreground">{m.email}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <UserPlusIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
            {atCap && (
              <p className="text-xs text-destructive">{t("drawer.teamFull")}</p>
            )}
          </section>

          {/* Pending invites for this team */}
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("drawer.pendingHeading")}
            </h3>
            {teamPending.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("drawer.noPending")}</p>
            ) : (
              <ul className="flex flex-col border border-border bg-card">
                {teamPending.map((p) => {
                  const busy = busyId === p.invitationId;
                  return (
                    <li
                      key={p.invitationId}
                      className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-sm text-muted-foreground">
                          {p.email}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {t("members.pendingBadge")}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        disabled={busy}
                        aria-label={t("members.revokeInvite")}
                        onClick={() => handleRevoke(p.invitationId)}
                      >
                        {busy ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <MailXIcon className="size-4" />
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button
              variant="outline"
              className="self-start"
              onClick={() => onInvite(team)}
            >
              <MailPlusIcon className="mr-2 size-4" />
              {t("drawer.inviteToTeam")}
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
