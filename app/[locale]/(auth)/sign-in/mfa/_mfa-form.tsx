"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { mfaChallengeAction } from "../../_actions";
import type { ActionResult } from "../../_actions";

export function MfaForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    mfaChallengeAction,
    null,
  );

  const error = state && "error" in state ? state.error : null;
  const fieldErrors = state && "error" in state ? state.fieldErrors : undefined;

  return (
    <div className="w-full max-w-sm rounded-[var(--radius-surface)] border border-border bg-card p-8">
      <h1 className="mb-2 text-xl font-semibold">{t("mfa.title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("mfa.description")}</p>

      <form action={formAction} className="flex flex-col gap-5">
        <FormField
          id="mfa-code"
          label={t("mfa.codeLabel")}
          error={fieldErrors?.code}
          describedBy={error ? "mfa-error" : undefined}
        >
          {({ id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby }) => (
            <Input
              id={id}
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              required
              disabled={pending}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedby}
              className="tracking-widest"
            />
          )}
        </FormField>

        {error && (
          <p id="mfa-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={pending}
          loading={pending}
        >
          {t("mfa.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="../sign-in"
          className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("mfa.backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
