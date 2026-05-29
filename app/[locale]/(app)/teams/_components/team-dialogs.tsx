"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/lib/i18n/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TEAM_COLOR_PALETTE } from "@/lib/teams/team-colors";
import {
  createTeamAction,
  renameTeamAction,
  setTeamColorAction,
  deleteTeamAction,
} from "../_actions";
import type { TeamRow } from "../_types";

type Translator = ReturnType<typeof useTranslations<"app.teams">>;

export function mapActionError(error: string, t: Translator): string {
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

function ColorField({
  value,
  onChange,
  disabled,
  t,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  t: Translator;
}) {
  return (
    <ColorPicker
      value={value}
      onChange={onChange}
      disabled={disabled}
      presets={TEAM_COLOR_PALETTE}
      presetsLabel={t("colorPicker.presetsLabel")}
      customLabel={t("colorPicker.customLabel")}
      hexLabel={t("colorPicker.hexLabel")}
    />
  );
}

// --- Create ---

export function CreateDialog({
  open,
  onOpenChange,
  onCreated,
  onCapExceeded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (team: TeamRow) => void;
  onCapExceeded: () => void;
}) {
  const t = useTranslations("app.teams");
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TEAM_COLOR_PALETTE[0]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
    if (!next) {
      setName("");
      setColor(TEAM_COLOR_PALETTE[0]);
      setNameError(null);
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
        handleOpenChange(false);
        router.refresh();
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
            <ColorField value={color} onChange={setColor} disabled={pending} t={t} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
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

// --- Rename ---

export function RenameDialog({
  team,
  open,
  onOpenChange,
  onRenamed,
}: {
  team: TeamRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: (name: string) => void;
}) {
  const t = useTranslations("app.teams");
  const router = useRouter();
  const [name, setName] = useState(team.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
    if (!next) {
      setName(team.name);
      setError(null);
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
    const previousName = team.name;
    startTransition(async () => {
      onRenamed(trimmed);
      const result = await renameTeamAction({ teamId: team.id, name: trimmed });
      if (result.error) {
        onRenamed(previousName);
        setError(
          result.error === "DUPLICATE_NAME"
            ? t("errors.duplicateName")
            : t("errors.generic"),
        );
        return;
      }
      toast.success(t("toasts.renamed"));
      onOpenChange(false);
      router.refresh();
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
          <Button variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
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

// --- Change color ---

export function ColorDialog({
  team,
  open,
  onOpenChange,
  onColorChanged,
}: {
  team: TeamRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColorChanged: (color: string) => void;
}) {
  const t = useTranslations("app.teams");
  const router = useRouter();
  const [color, setColor] = useState(team.color);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
    if (!next) setColor(team.color);
  }

  function handleSave() {
    const previousColor = team.color;
    startTransition(async () => {
      onColorChanged(color);
      const result = await setTeamColorAction({ teamId: team.id, color });
      if (result.error) {
        onColorChanged(previousColor);
        toast.error(mapActionError(result.error, t));
        return;
      }
      toast.success(t("toasts.colorChanged"));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("team.changeColor")}</DialogTitle>
        </DialogHeader>
        <ColorField value={color} onChange={setColor} disabled={pending} t={t} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            {t("createDialog.cancel")}
          </Button>
          <Button disabled={pending} onClick={handleSave}>
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

// --- Delete ---

export function DeleteDialog({
  team,
  open,
  onOpenChange,
  onDeleted,
  onDeleteFailed,
}: {
  team: TeamRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onDeleteFailed: (team: TeamRow) => void;
}) {
  const t = useTranslations("app.teams");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  function handleDelete() {
    startTransition(async () => {
      onDeleted();
      const result = await deleteTeamAction({ teamId: team.id });
      if (result.error) {
        onDeleteFailed(team);
        toast.error(mapActionError(result.error, t));
        return;
      }
      toast.success(t("toasts.deleted"));
      onOpenChange(false);
      router.refresh();
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
          <Button variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
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

// --- Upsell ---

export function UpsellDialog({
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
  const t = useTranslations("app.teams");

  const body =
    plan === "pro"
      ? t("upsell.proAtCapBody", { max: maxTeams })
      : t("upsell.atCapBody", {
          plan: plan.charAt(0).toUpperCase() + plan.slice(1),
          max: maxTeams,
        });

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
            <Link href="/pricing" className={buttonVariants({ variant: "default" })}>
              {t("upsell.cta")}
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
