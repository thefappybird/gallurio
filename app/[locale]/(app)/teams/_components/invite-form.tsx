"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { inviteMemberAction } from "../_invite-action";
import type { InvitableTeam } from "../_types";

export type { InvitableTeam };

type InviteFormProps = {
  teams: InvitableTeam[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Teams pre-checked when the dialog opens (per-team invite entry points). */
  defaultTeamIds?: string[];
  onInvited?: (email: string) => void;
};

export function InviteForm({
  teams,
  open,
  onOpenChange,
  defaultTeamIds,
  onInvited,
}: InviteFormProps) {
  const t = useTranslations("app.teams");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [leadOnTeamIds, setLeadOnTeamIds] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const noTeamsAvailable = teams.length === 0;

  // Seed the team selection each time the dialog opens so per-team entry points
  // ("Invite to this team") arrive pre-checked, while the global button opens
  // with a clean slate. Deferred to a microtask so the reset doesn't run
  // synchronously inside the effect body (cascading-render lint rule).
  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      setEmail("");
      setLeadOnTeamIds(new Set());
      setFormError(null);
      setSelectedTeamIds(new Set(defaultTeamIds ?? []));
    });
  }, [open, defaultTeamIds]);

  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  function toggleTeam(id: string, next: boolean) {
    setSelectedTeamIds((prev) => {
      const out = new Set(prev);
      if (next) {
        out.add(id);
      } else {
        out.delete(id);
        setLeadOnTeamIds((leads) => {
          const updated = new Set(leads);
          updated.delete(id);
          return updated;
        });
      }
      return out;
    });
  }

  function toggleLead(id: string, next: boolean) {
    setLeadOnTeamIds((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  }

  function handleSubmit() {
    if (!email.trim()) {
      setFormError(t("invite.errors.emailRequired"));
      return;
    }
    if (selectedTeamIds.size === 0) {
      setFormError(t("invite.errors.pickAtLeastOneTeam"));
      return;
    }
    setFormError(null);

    startTransition(async () => {
      const result = await inviteMemberAction({
        email: email.trim(),
        teamIds: Array.from(selectedTeamIds),
        leadOnTeamIds: Array.from(leadOnTeamIds),
      });
      if (result.error) {
        if (result.error === "TEAM_SEAT_CAP_EXCEEDED") {
          const names = (result.fullTeamNames ?? []).join(", ");
          setFormError(t("invite.errors.teamFull", { teams: names || "—" }));
          return;
        }
        if (result.error === "ALREADY_INVITED_OR_MEMBER") {
          setFormError(t("invite.errors.alreadyInvitedOrMember"));
          return;
        }
        if (result.error === "TEAM_NOT_FOUND") {
          setFormError(t("invite.errors.teamNotFound"));
          return;
        }
        setFormError(t("errors.generic"));
        return;
      }
      toast.success(t("invite.toasts.sent"));
      onInvited?.(email.trim().toLowerCase());
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("invite.dialog.title")}</DialogTitle>
          <DialogDescription>{t("invite.dialog.description")}</DialogDescription>
        </DialogHeader>

        {noTeamsAvailable ? (
          <p className="border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {t("invite.errors.noTeamsExist")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email">{t("invite.dialog.emailLabel")}</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder={t("invite.dialog.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("invite.dialog.teamsLabel")}</Label>
              <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto border border-border bg-card p-1">
                {teams.map((team) => {
                  const selected = selectedTeamIds.has(team.id);
                  const atCap = team.memberCount >= team.maxMembersPerTeam;
                  const isLead = leadOnTeamIds.has(team.id);
                  return (
                    <li
                      key={team.id}
                      className="flex items-center gap-3 border border-transparent bg-background px-3 py-2 hover:border-border"
                    >
                      <input
                        id={`invite-team-${team.id}`}
                        type="checkbox"
                        checked={selected}
                        disabled={pending || (atCap && !selected)}
                        onChange={(e) => toggleTeam(team.id, e.target.checked)}
                        className="size-4 cursor-pointer accent-foreground"
                      />
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: team.color, width: 14, height: 14 }}
                        className="shrink-0"
                      />
                      <label
                        htmlFor={`invite-team-${team.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <span className="font-medium">{team.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {team.memberCount}/{team.maxMembersPerTeam}
                        </span>
                        {atCap && !selected && (
                          <span className="ml-2 text-xs text-destructive">
                            {t("invite.dialog.teamFull")}
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`invite-lead-${team.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          {t("invite.dialog.leadLabel")}
                        </Label>
                        <Switch
                          id={`invite-lead-${team.id}`}
                          checked={isLead}
                          disabled={pending || !selected}
                          onCheckedChange={(v) => toggleLead(team.id, v)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {formError && (
              <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            {t("createDialog.cancel")}
          </Button>
          <Button disabled={pending || noTeamsAvailable} onClick={handleSubmit}>
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("invite.dialog.sending")}
              </>
            ) : (
              t("invite.dialog.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
