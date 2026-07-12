"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  verifyEmailAction,
  resendVerificationEmailAction,
} from "../_actions";
import type { ActionResult } from "../_actions";

export function VerifyEmailForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    verifyEmailAction,
    null,
  );
  const [resendState, resendAction, resendPending] = useActionState<
    ActionResult | null,
    FormData
  >(resendVerificationEmailAction, null);

  const error = state && "error" in state ? state.error : null;
  const resendOk = resendState && "ok" in resendState;
  const resendError = resendState && "error" in resendState ? resendState.error : null;

  return (
    <div className="w-full max-w-sm rounded-[var(--radius-surface)] border border-border bg-card p-8">
      <h1 className="mb-2 text-xl font-semibold">{t("verifyEmail.title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t("verifyEmail.description")}
      </p>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="verify-code">{t("verifyEmail.codeLabel")}</Label>
          <Input
            id="verify-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="000000"
            required
            disabled={pending}
            aria-describedby={error ? "verify-error" : undefined}
            className="tracking-widest"
          />
        </div>

        {error && (
          <p id="verify-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={pending}
          loading={pending}
        >
          {t("verifyEmail.submit")}
        </Button>
      </form>

      {/* Resend */}
      <div className="mt-6 text-center">
        {resendOk ? (
          <p className="text-sm text-muted-foreground">{t("verifyEmail.resendSent")}</p>
        ) : (
          <form action={resendAction}>
            <Button
              type="submit"
              variant="link"
              className="h-auto p-0 text-sm font-medium text-foreground"
              disabled={resendPending}
              loading={resendPending}
            >
              {t("verifyEmail.resend")}
            </Button>
          </form>
        )}
        {resendError && (
          <p className="mt-1 text-sm text-destructive">{resendError}</p>
        )}
      </div>
    </div>
  );
}
