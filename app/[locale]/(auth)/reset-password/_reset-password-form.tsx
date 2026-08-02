"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFieldError } from "@/components/ui/form-field";
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
  const fieldErrors = state && "error" in state ? state.fieldErrors : undefined;
  // The mismatch branch sets fieldErrors.confirmPassword to the same sentence as
  // the top-level error -- render it once, on the field, not duplicated up top.
  const topError = error && error === fieldErrors?.confirmPassword ? null : error;

  const passwordA11y = useFieldError(fieldErrors?.password, {
    id: "reset-password",
    describedBy: topError ? "reset-error" : undefined,
  });
  const confirmPasswordA11y = useFieldError(fieldErrors?.confirmPassword, {
    id: "reset-confirm",
    describedBy: topError ? "reset-error" : undefined,
  });

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
          <Label htmlFor={passwordA11y.id}>{t("resetPassword.passwordLabel")}</Label>
          <div className="relative">
            <Input
              id={passwordA11y.id}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={pending}
              className="pe-10"
              aria-invalid={passwordA11y["aria-invalid"]}
              aria-describedby={passwordA11y["aria-describedby"]}
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
          {fieldErrors?.password && (
            <p id={passwordA11y.errorId} role="alert" className="text-xs text-destructive">
              {fieldErrors.password}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t("signUp.passwordHint")}</p>
        </div>

        {/* Confirm password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={confirmPasswordA11y.id}>{t("fields.confirmPassword")}</Label>
          <div className="relative">
            <Input
              id={confirmPasswordA11y.id}
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={pending}
              className="pe-10"
              aria-invalid={confirmPasswordA11y["aria-invalid"]}
              aria-describedby={confirmPasswordA11y["aria-describedby"]}
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
          {fieldErrors?.confirmPassword && (
            <p id={confirmPasswordA11y.errorId} role="alert" className="text-xs text-destructive">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {topError && (
          <p id="reset-error" role="alert" className="text-sm text-destructive">
            {topError}
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
