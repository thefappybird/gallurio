"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "../_actions";
import type { ActionResult } from "../_actions";

interface ResetPasswordFormProps {
  token: string | undefined;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    resetPasswordAction,
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const success = state && "ok" in state;
  const error = state && "error" in state ? state.error : null;

  if (!token) {
    return (
      <div className="w-full max-w-sm rounded-[var(--radius-surface)] border border-border bg-card p-8">
        <h1 className="mb-4 text-xl font-semibold">{t("resetPassword.title")}</h1>
        <p className="text-sm text-destructive">{t("resetPassword.invalidToken")}</p>
        <p className="mt-6 text-center text-sm">
          <Link
            href="./forgot-password"
            className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("resetPassword.requestNewLink")}
          </Link>
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-sm rounded-[var(--radius-surface)] border border-border bg-card p-8">
        <h1 className="mb-4 text-xl font-semibold">{t("resetPassword.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("resetPassword.successMessage")}
        </p>
        <p className="mt-6 text-center text-sm">
          <Link
            href="./sign-in"
            className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("resetPassword.signIn")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-[var(--radius-surface)] border border-border bg-card p-8">
      <h1 className="mb-2 text-xl font-semibold">{t("resetPassword.title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t("resetPassword.description")}
      </p>

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="token" value={token} />

        {/* New password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password">{t("resetPassword.passwordLabel")}</Label>
          <div className="relative">
            <Input
              id="reset-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={pending}
              className="pe-10"
              aria-describedby={error ? "reset-error" : undefined}
            />
            <button
              type="button"
              className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? t("fields.hidePassword") : t("fields.showPassword")
              }
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t("signUp.passwordHint")}</p>
        </div>

        {/* Confirm password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm">{t("fields.confirmPassword")}</Label>
          <div className="relative">
            <Input
              id="reset-confirm"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={pending}
              className="pe-10"
              aria-describedby={error ? "reset-error" : undefined}
            />
            <button
              type="button"
              className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={
                showConfirm ? t("fields.hidePassword") : t("fields.showPassword")
              }
            >
              {showConfirm ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <p id="reset-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={pending}
          loading={pending}
        >
          {t("resetPassword.submit")}
        </Button>
      </form>
    </div>
  );
}
