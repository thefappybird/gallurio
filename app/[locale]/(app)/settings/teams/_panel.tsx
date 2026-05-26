"use client";

import { useState, useTransition, useOptimistic, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Loader2, Pencil, Palette, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  createTeamAction,
  renameTeamAction,
  setTeamColorAction,
  deleteTeamAction,
} from "./_actions";

const TEAM_COLOR_PALETTE = [
  "#0d7377",
  "#7c5cff",
  "#e87a4f",
  "#c9aa55",
  "#5fb3a8",
  "#8a8b94",
] as const;

type Team = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  memberCount: number;
};

type TeamsPanelProps = {
  teams: Team[];
  plan: "free" | "starter" | "pro";
  maxTeams: number;
};

type OptimisticAction =
  | { type: "add"; team: Team }
  | { type: "rename"; id: string; name: string }
  | { type: "color"; id: string; color: string }
  | { type: "delete"; id: string };

function applyOptimistic(teams: Team[], action: OptimisticAction): Team[] {
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

function mapActionError(
  error: string,
  t: ReturnType<typeof useTranslations<"app.settings.teams">>
): string {
  switch (error) {
    case "DUPLICATE_NAME":
      return t("errors.duplicateName");
    case "CANNOT_DELETE_DEFAULT":
      return t("errors.cannotDeleteDefault");
    case "Team not found":
      return t("errors.teamNotFound");
    default:
      return t("errors.generic");
  }
}

// --- Color Change Dialog ---

function ColorDialog({
  team,
  open,
  onOpenChange,
  onColorChanged,
}: {
  team: Team;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColorChanged: (color: string) => void;
}) {
  const t = useTranslations("app.settings.teams");
  const [pending, startTransition] = useTransition();

  function handleSelect(color: string) {
    startTransition(async () => {
      onColorChanged(color);
      const result = await setTeamColorAction({ teamId: team.id, color });
      if (result.error) {
        toast.error(mapActionError(result.error, t));
      } else {
        toast.success(t("toasts.colorChanged"));
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("team.changeColor")}</DialogTitle>
        </DialogHeader>
        <div
          className="flex flex-wrap gap-2 py-2"
          role="group"
          aria-label={t("createDialog.colorLabel")}
        >
          {TEAM_COLOR_PALETTE.map((hex) => (
            <button
              key={hex}
              type="button"
              disabled={pending}
              onClick={() => handleSelect(hex)}
              className="size-10 cursor-pointer border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50"
              style={{
                backgroundColor: hex,
                borderColor: hex === team.color ? "var(--foreground)" : "transparent",
              }}
              aria-label={hex}
              aria-pressed={hex === team.color}
            />
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("createDialog.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Rename Dialog ---

function RenameDialog({
  team,
  open,
  onOpenChange,
  onRenamed,
}: {
  team: Team;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: (name: string) => void;
}) {
  const t = useTranslations("app.settings.teams");
  const [name, setName] = useState(team.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!pending) {
      onOpenChange(next);
      if (!next) {
        setName(team.name);
        setError(null);
      }
    }
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("errors.nameRequired"));
      return;
    }
    if (trimmed.length > 40) {
      setError(t("errors.nameTooLong"));
      return;
    }
    setError(null);
    startTransition(async () => {
      onRenamed(trimmed);
      const result = await renameTeamAction({ teamId: team.id, name: trimmed });
      if (result.error) {
        setError(
          result.error === "DUPLICATE_NAME"
            ? t("errors.duplicateName")
            : t("errors.generic")
        );
        return;
      }
      toast.success(t("toasts.renamed"));
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("renameDialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rename-team-input">{t("createDialog.nameLabel")}</Label>
          <Input
            id="rename-team-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            disabled={pending}
            maxLength={40}
            autoFocus
          />
          {error && (
            <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {t("renameDialog.cancel")}
          </Button>
          <Button disabled={pending || !name.trim()} onClick={handleSubmit}>
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("renameDialog.saving")}
              </>
            ) : (
              t("renameDialog.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Delete Dialog ---

function DeleteDialog({
  team,
  open,
  onOpenChange,
  onDeleted,
}: {
  team: Team;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("app.settings.teams");
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!pending) onOpenChange(next);
  }

  function handleDelete() {
    startTransition(async () => {
      onDeleted();
      const result = await deleteTeamAction({ teamId: team.id });
      if (result.error) {
        toast.error(mapActionError(result.error, t));
        return;
      }
      toast.success(t("toasts.deleted"));
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteDialog.title")}</DialogTitle>
          <DialogDescription>{t("deleteDialog.description")}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {t("deleteDialog.cancel")}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("deleteDialog.deleting")}
              </>
            ) : (
              t("deleteDialog.confirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Create Dialog ---

function CreateDialog({
  open,
  onOpenChange,
  onCreated,
  onCapExceeded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (team: Team) => void;
  onCapExceeded: () => void;
}) {
  const t = useTranslations("app.settings.teams");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TEAM_COLOR_PALETTE[0]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!pending) {
      onOpenChange(next);
      if (!next) {
        setName("");
        setColor(TEAM_COLOR_PALETTE[0]);
        setNameError(null);
      }
    }
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t("errors.nameRequired"));
      return;
    }
    if (trimmed.length > 40) {
      setNameError(t("errors.nameTooLong"));
      return;
    }
    setNameError(null);

    startTransition(async () => {
      const result = await createTeamAction({ name: trimmed, color });
      if (result.error) {
        if (result.error === "TEAM_CAP_EXCEEDED") {
          onOpenChange(false);
          onCapExceeded();
          return;
        }
        if (result.error === "DUPLICATE_NAME") {
          setNameError(t("errors.duplicateName"));
          return;
        }
        toast.error(t("errors.generic"));
        return;
      }
      if (result.team) {
        onCreated(result.team);
        toast.success(t("toasts.created"));
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createDialog.title")}</DialogTitle>
          <DialogDescription>{t("createDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-team-name">{t("createDialog.nameLabel")}</Label>
            <Input
              id="create-team-name"
              placeholder={t("createDialog.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              disabled={pending}
              maxLength={40}
              autoFocus
            />
            {nameError && (
              <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {nameError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("createDialog.colorLabel")}</Label>
            <div
              className="flex gap-1.5"
              role="group"
              aria-label={t("createDialog.colorLabel")}
            >
              {TEAM_COLOR_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  className="size-8 cursor-pointer border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50"
                  style={{
                    backgroundColor: hex,
                    borderColor: hex === color ? "var(--foreground)" : "transparent",
                  }}
                  aria-label={hex}
                  aria-pressed={hex === color}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {t("createDialog.cancel")}
          </Button>
          <Button disabled={pending || !name.trim()} onClick={handleSubmit}>
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("createDialog.creating")}
              </>
            ) : (
              t("createDialog.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Upsell Dialog ---

function UpsellDialog({
  open,
  onOpenChange,
  plan,
  maxTeams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: "free" | "starter" | "pro";
  maxTeams: number;
}) {
  const t = useTranslations("app.settings.teams");

  const body =
    plan === "pro"
      ? t("upsell.proAtCapBody", { max: maxTeams })
      : t("upsell.atCapBody", { plan: plan.charAt(0).toUpperCase() + plan.slice(1), max: maxTeams });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("upsell.atCapTitle")}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("createDialog.cancel")}
          </Button>
          {plan !== "pro" && (
            <a
              href="/pricing#teams"
              className={buttonVariants({ variant: "default" })}
            >
              {t("upsell.cta")}
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Team Row ---

function TeamRow({
  team,
  onRename,
  onColorChange,
  onDelete,
}: {
  team: Team;
  onRename: (name: string) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("app.settings.teams");
  const [renameOpen, setRenameOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
        {/* Color swatch */}
        <span
          aria-hidden="true"
          className="shrink-0"
          style={{ width: 24, height: 24, backgroundColor: team.color }}
        />

        {/* Name + badges */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="truncate font-semibold">{team.name}</span>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {team.isDefault && (
              <Badge variant="secondary" className="text-xs">
                {t("team.defaultBadge")}
              </Badge>
            )}
            <span>{t("team.memberCount", { count: team.memberCount })}</span>
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Actions for ${team.name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" side="bottom">
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <Pencil className="size-4" />
              {t("team.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setColorOpen(true)}>
              <Palette className="size-4" />
              {t("team.changeColor")}
            </DropdownMenuItem>
            {!team.isDefault && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  {t("team.delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RenameDialog
        team={team}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onRenamed={onRename}
      />
      <ColorDialog
        team={team}
        open={colorOpen}
        onOpenChange={setColorOpen}
        onColorChanged={onColorChange}
      />
      <DeleteDialog
        team={team}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onDelete}
      />
    </>
  );
}

// --- Main Panel ---

export function TeamsPanel({ teams: initialTeams, plan, maxTeams }: TeamsPanelProps) {
  const t = useTranslations("app.settings.teams");

  const [createOpen, setCreateOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);

  const [optimisticTeams, dispatch] = useOptimistic(
    initialTeams,
    applyOptimistic
  );

  const atCap = optimisticTeams.length >= maxTeams;

  const handleCreateClick = useCallback(() => {
    if (atCap) {
      setUpsellOpen(true);
    } else {
      setCreateOpen(true);
    }
  }, [atCap]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header + action bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          onClick={handleCreateClick}
          aria-disabled={atCap}
          className="shrink-0"
        >
          {t("createButton")}
        </Button>
      </div>

      {/* Team list */}
      <div>
        {optimisticTeams.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("listEmpty")}</p>
        ) : (
          <div>
            {optimisticTeams.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                onRename={(name) => dispatch({ type: "rename", id: team.id, name })}
                onColorChange={(color) => dispatch({ type: "color", id: team.id, color })}
                onDelete={() => dispatch({ type: "delete", id: team.id })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(team) => dispatch({ type: "add", team })}
        onCapExceeded={() => setUpsellOpen(true)}
      />

      <UpsellDialog
        open={upsellOpen}
        onOpenChange={setUpsellOpen}
        plan={plan}
        maxTeams={maxTeams}
      />
    </div>
  );
}
