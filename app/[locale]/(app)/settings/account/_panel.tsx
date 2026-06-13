"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { updateProfileNameAction } from "../_actions";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
});
type FormValues = z.infer<typeof schema>;

function getInitials(name: string, email: string): string {
  const n = name.trim();
  if (n.length > 0) {
    const parts = n.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }
    return (parts[0]![0] ?? "").toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "U";
}

type Props = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

export function AccountPanel({ name, email, avatarUrl }: Props) {
  const t = useTranslations("app.settings.account");
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(name);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await updateProfileNameAction(values);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        setDisplayName(values.name);
        toast.success(t("nameSaved"));
      }
    });
  }

  const initials = getInitials(displayName, email);

  return (
    <div className="flex flex-col gap-8">
      {/* Avatar */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("profileSection")}</h2>
          <p className="text-sm text-muted-foreground">{t("profileHint")}</p>
        </div>
        <div className="flex items-center gap-4">
          <Avatar size="lg" className="size-14">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={displayName || email} />
            ) : null}
            <AvatarFallback className="text-base">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{displayName || email}</span>
            <span className="text-xs text-muted-foreground">{t("avatarHint")}</span>
          </div>
        </div>
      </section>

      {/* Name form */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">{t("nameSection")}</h2>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name">{t("nameLabel")}</Label>
            <Input
              id="profile-name"
              type="text"
              autoComplete="name"
              disabled={pending}
              aria-describedby={errors.name ? "profile-name-error" : undefined}
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p
                id="profile-name-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email — read-only; email change is out of scope */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-email">{t("emailLabel")}</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              readOnly
              disabled
              aria-describedby="profile-email-hint"
              className="cursor-not-allowed"
            />
            <p
              id="profile-email-hint"
              className="text-xs text-muted-foreground"
            >
              {t("emailReadOnly")}
            </p>
          </div>

          <div>
            <Button
              type="submit"
              disabled={pending || !isDirty}
              className="min-h-11 min-w-28"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  {t("saving")}
                </>
              ) : (
                t("saveName")
              )}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
