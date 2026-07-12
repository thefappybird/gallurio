"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget, type TurnstileWidgetHandle } from "../_components/turnstile-widget";
import { signUpAction, googleSignInAction } from "../_actions";
import type { ActionResult } from "../_actions";
import { useTransition } from "react";

type SignUpFormProps = {
  lockedEmail?: string | null;
};

export function SignUpForm({ lockedEmail = null }: SignUpFormProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    signUpAction,
    null,
  );
  const [turnstileToken, setTurnstileToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [googlePending, startGoogleTransition] = useTransition();
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const error = state && "error" in state ? state.error : null;

  // Turnstile tokens are single-use -- a retry after any failed submission
  // would otherwise fail bot verification even with valid form input.
  // reset() re-fires onToken with a fresh token once ready, which already
  // flows through the onToken={setTurnstileToken} wiring below.
  useEffect(() => {
    if (!error) return;
    turnstileRef.current?.reset();
  }, [error]);

  function handleGoogleSignIn() {
    startGoogleTransition(async () => {
      const result = await googleSignInAction();
      if ("url" in result) {
        router.push(result.url);
      }
    });
  }

  return (
    <div className="w-full max-w-sm rounded-[var(--radius-surface)] border border-border bg-card p-8">
      <h1 className="mb-6 text-xl font-semibold">{t("signUp.title")}</h1>

      {/* Google sign-up */}
      <Button
        type="button"
        variant="outline"
        className="mb-6 w-full"
        onClick={handleGoogleSignIn}
        disabled={googlePending || pending}
        loading={googlePending}
      >
        <GoogleIcon />
        {t("signUp.continueWithGoogle")}
      </Button>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">{t("signIn.or")}</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        {/* Hidden Turnstile token */}
        <input
          type="hidden"
          name="cf-turnstile-response"
          value={turnstileToken}
        />
        {lockedEmail ? (
          <input type="hidden" name="email" value={lockedEmail} />
        ) : null}

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-firstname">{t("fields.firstName")}</Label>
            <Input
              id="signup-firstname"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-lastname">
              {t("fields.lastName")}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {t("fields.optional")}
              </span>
            </Label>
            <Input
              id="signup-lastname"
              name="lastName"
              type="text"
              autoComplete="family-name"
              disabled={pending}
            />
          </div>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-email">{t("fields.email")}</Label>
          <Input
            id="signup-email"
            name={lockedEmail ? undefined : "email"}
            type="email"
            autoComplete="email"
            required
            disabled={pending || Boolean(lockedEmail)}
            defaultValue={lockedEmail ?? undefined}
            aria-describedby={error ? "signup-error" : undefined}
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-password">{t("fields.password")}</Label>
          <div className="relative">
            <Input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={pending}
              className="pe-10"
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
          <p className="text-xs text-muted-foreground">
            {t("signUp.passwordHint")}
          </p>
        </div>

        {/* Confirm password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-confirm">{t("fields.confirmPassword")}</Label>
          <div className="relative">
            <Input
              id="signup-confirm"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={pending}
              className="pe-10"
              aria-describedby={error ? "signup-error" : undefined}
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

        {/* Turnstile */}
        <div className="flex justify-center">
          <TurnstileWidget
            ref={turnstileRef}
            onToken={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            onError={() => setTurnstileToken("")}
          />
        </div>

        {/* Error */}
        {error && (
          <p id="signup-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={pending || !turnstileToken}
          loading={pending}
        >
          {t("signUp.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("signUp.hasAccount")}{" "}
        <Link
          href="./sign-in"
          className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("signIn.title")}
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
