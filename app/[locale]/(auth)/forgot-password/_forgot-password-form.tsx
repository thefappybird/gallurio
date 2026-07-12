"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "../_components/turnstile-widget";
import { forgotPasswordAction } from "../_actions";
import type { ActionResult } from "../_actions";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    forgotPasswordAction,
    null,
  );
  const [turnstileToken, setTurnstileToken] = useState("");

  const success = state && "ok" in state;
  const error = state && "error" in state ? state.error : null;

  if (success) {
    return (
      <div className="w-full max-w-sm rounded-[var(--radius-surface)] border border-border bg-card p-8">
        <h1 className="mb-4 text-xl font-semibold">{t("forgotPassword.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("forgotPassword.successMessage")}
        </p>
        <p className="mt-6 text-center text-sm">
          <Link
            href="./sign-in"
            className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("forgotPassword.backToSignIn")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-[var(--radius-surface)] border border-border bg-card p-8">
      <h1 className="mb-2 text-xl font-semibold">{t("forgotPassword.title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t("forgotPassword.description")}
      </p>

      <form action={formAction} className="flex flex-col gap-5">
        <input
          type="hidden"
          name="cf-turnstile-response"
          value={turnstileToken}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="forgot-email">{t("fields.email")}</Label>
          <Input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            aria-describedby={error ? "forgot-error" : undefined}
          />
        </div>

        <TurnstileWidget
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
          onError={() => setTurnstileToken("")}
        />

        {error && (
          <p id="forgot-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={pending || !turnstileToken}
          loading={pending}
        >
          {t("forgotPassword.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="./sign-in"
          className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("forgotPassword.backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
