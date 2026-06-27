"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePasswordAction, sendSetPasswordEmailAction } from "../_actions";

function makeChangePasswordSchema(t: (key: string) => string) {
  return z
    .object({
      currentPassword: z.string().min(1, t("passwordRequired")),
      newPassword: z.string().min(8, t("passwordTooShort")).max(128),
      confirmPassword: z.string().min(1),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: t("passwordMismatch"),
      path: ["confirmPassword"],
    });
}

type Props = { hasOAuth: boolean };

export function PasswordSection({ hasOAuth }: Props) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      {hasOAuth ? <SetPasswordCard /> : <ChangePasswordForm />}
    </section>
  );
}

function ChangePasswordForm() {
  const t = useTranslations("app.settings.account");
  const [pending, startTransition] = useTransition();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const schema = useMemo(() => makeChangePasswordSchema(t), [t]);
  type FormValues = z.infer<ReturnType<typeof makeChangePasswordSchema>>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await updatePasswordAction(values);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t("passwordSaved"));
        reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    });
  }

  const fields = [
    {
      id: "current-password",
      label: t("currentPasswordLabel"),
      name: "currentPassword" as const,
      autoComplete: "current-password",
      show: showCurrent,
      toggle: () => setShowCurrent((v) => !v),
      hint: undefined as string | undefined,
    },
    {
      id: "new-password",
      label: t("newPasswordLabel"),
      name: "newPassword" as const,
      autoComplete: "new-password",
      show: showNew,
      toggle: () => setShowNew((v) => !v),
      hint: t("newPasswordHint"),
    },
    {
      id: "confirm-password",
      label: t("confirmPasswordLabel"),
      name: "confirmPassword" as const,
      autoComplete: "new-password",
      show: showConfirm,
      toggle: () => setShowConfirm((v) => !v),
      hint: undefined,
    },
  ];

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">{t("passwordSection")}</h2>
        <p className="text-sm text-muted-foreground">{t("passwordHint")}</p>
      </div>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {fields.map((f) => (
          <div key={f.id} className="flex flex-col gap-1.5">
            <Label htmlFor={f.id}>{f.label}</Label>
            <div className="relative">
              <Input
                id={f.id}
                type={f.show ? "text" : "password"}
                autoComplete={f.autoComplete}
                disabled={pending}
                className="pe-10"
                aria-invalid={!!errors[f.name]}
                aria-describedby={errors[f.name] ? `${f.id}-error` : undefined}
                {...register(f.name)}
              />
              <button
                type="button"
                className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={f.toggle}
                aria-label={f.show ? t("hidePassword") : t("showPassword")}
              >
                {f.show ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {f.hint && (
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            )}
            {errors[f.name] && (
              <p
                id={`${f.id}-error`}
                role="alert"
                className="text-xs text-destructive"
              >
                {errors[f.name]?.message}
              </p>
            )}
          </div>
        ))}
        <div>
          <Button
            type="submit"
            disabled={pending}
            className="min-h-11 min-w-28"
          >
            {pending ? (
              <>
                <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
                {t("updatingPassword")}
              </>
            ) : (
              t("changePassword")
            )}
          </Button>
        </div>
      </form>
    </>
  );
}

function SetPasswordCard() {
  const t = useTranslations("app.settings.account");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const result = await sendSetPasswordEmailAction();
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        setSent(true);
        toast.success(t("setPasswordSent"));
      }
    });
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">{t("passwordSection")}</h2>
        <p className="text-sm text-muted-foreground">{t("setPasswordHint")}</p>
      </div>
      {sent ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("setPasswordSent")}
        </p>
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={handleClick}
            disabled={pending}
            className="min-h-11"
          >
            {pending ? (
              <>
                <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
                {t("sendingSetPassword")}
              </>
            ) : (
              t("resetPassword")
            )}
          </Button>
        </div>
      )}
    </>
  );
}
