"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/lib/i18n/navigation";
import { Loader2Icon } from "lucide-react";
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
  deactivateTeamAction,
  reactivateTeamAction,
} from "../_actions";
import type { TeamRow } from "../_types";

type Translator = ReturnType<typeof useTranslations<"app.teams">>;

export function mapActionError(error: string, t: Translator): string {
  switch (error) {
    case "DUPLICATE_NAME":
      return t("errors.duplicateName");
    case "CANNOT_DEACTIVATE_DEFAULT":
      return t("errors.cannotDeactivateDefault");
    case "REACTIVATE_CAP_EXCEEDED":
      return t("errors.reactivateCapExceeded");
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
                <Loader2Icon className="me-2 size-4 animate-spin" />
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

// --- Edit (name + color) ---

export function EditDialog({
  team,
  open,
  onOpenChange,
  onRenamed,
  onColorChanged,
}: {
  team: TeamRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: (name: string) => void;
  onColorChanged: (color: string) => void;
}) {
  const t = useTranslations("app.teams");
  const router = useRouter();
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
    if (!next) {
      setName(team.name);
      setColor(team.color);
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

    const nameChanged = trimmed !== team.name;
    const colorChanged = color !== team.color;
    if (!nameChanged && !colorChanged) {
      onOpenChange(false);
      return;
    }

    const prevName = team.name;
    const prevColor = team.color;

    startTransition(async () => {
      // Optimistically apply both changes; roll back per-field on failure.
      if (nameChanged) onRenamed(trimmed);
      if (colorChanged) onColorChanged(color);

      if (nameChanged) {
        const result = await renameTeamAction({ teamId: team.id, name: trimmed });
        if (result.error) {
          onRenamed(prevName);
          if (colorChanged) onColorChanged(prevColor);
          setError(
            result.error === "DUPLICATE_NAME"
              ? t("errors.duplicateName")
              : t("errors.generic"),
          );
          return;
        }
      }

      if (colorChanged) {
        const result = await setTeamColorAction({ teamId: team.id, color });
        if (result.error) {
          onColorChanged(prevColor);
          setError(mapActionError(result.error, t));
          return;
        }
      }

      toast.success(t("toasts.saved"));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editDialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-team-name">{t("createDialog.nameLabel")}</Label>
            <Input
              id="edit-team-name"
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
                <Loader2Icon className="me-2 size-4 animate-spin" />
                {t("editDialog.saving")}
              </>
            ) : (
              t("editDialog.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Deactivate ---

export function DeactivateDialog({
  team,
  open,
  onOpenChange,
  onDeactivated,
  onFailed,
}: {
  team: TeamRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeactivated: () => void;
  onFailed: (team: TeamRow) => void;
}) {
  const t = useTranslations("app.teams");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  function handleDeactivate() {
    startTransition(async () => {
      onDeactivated();
      const result = await deactivateTeamAction({ teamId: team.id });
      if (result.error) {
        onFailed(team);
        toast.error(mapActionError(result.error, t));
        return;
      }
      toast.success(t("toasts.deactivated"));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deactivateDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("deactivateDialog.description", { name: team.name })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            {t("deactivateDialog.cancel")}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={handleDeactivate}>
            {pending ? (
              <>
                <Loader2Icon className="me-2 size-4 animate-spin" />
                {t("deactivateDialog.deactivating")}
              </>
            ) : (
              t("deactivateDialog.confirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Reactivate ---

export function ReactivateDialog({
  team,
  open,
  onOpenChange,
  onReactivated,
  onFailed,
}: {
  team: TeamRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReactivated: () => void;
  onFailed: (team: TeamRow) => void;
}) {
  const t = useTranslations("app.teams");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  function handleReactivate() {
    startTransition(async () => {
      onReactivated();
      const result = await reactivateTeamAction({ teamId: team.id });
      if (result.error) {
        onFailed(team);
        toast.error(mapActionError(result.error, t));
        return;
      }
      toast.success(t("toasts.reactivated"));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reactivateDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("reactivateDialog.description", { name: team.name })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            {t("reactivateDialog.cancel")}
          </Button>
          <Button variant="default" disabled={pending} onClick={handleReactivate}>
            {pending ? (
              <>
                <Loader2Icon className="me-2 size-4 animate-spin" />
                {t("reactivateDialog.reactivating")}
              </>
            ) : (
              t("reactivateDialog.confirm")
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
