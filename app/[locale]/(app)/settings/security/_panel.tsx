"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Loader2, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  enrollMfaAction,
  verifyMfaEnrollmentAction,
  disableMfaAction,
  type EnrollMfaResult,
} from "../_actions";

// ---------------------------------------------------------------------------
// Code input schema
// ---------------------------------------------------------------------------

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});
type CodeValues = z.infer<typeof codeSchema>;

// ---------------------------------------------------------------------------
// Copy-to-clipboard helper
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available — user can copy manually
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy secret key"}
      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-70"
    >
      {copied ? (
        <>
          <Check className="size-3" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3" aria-hidden />
          Copy
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// MFA setup flow
// ---------------------------------------------------------------------------

type EnrollState =
  | { step: "idle" }
  | { step: "qr"; qrCode: string; secret: string }
  | { step: "done" };

function MfaSetupFlow({
  onDone,
  t,
}: {
  onDone: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [enrollState, setEnrollState] = useState<EnrollState>({ step: "idle" });
  const [enrollPending, startEnroll] = useTransition();
  const [verifyPending, startVerify] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
  });

  function handleStartSetup() {
    startEnroll(async () => {
      const result: EnrollMfaResult = await enrollMfaAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setEnrollState({ step: "qr", ...result });
    });
  }

  function handleVerify(values: CodeValues) {
    if (enrollState.step !== "qr") return;
    startVerify(async () => {
      const result = await verifyMfaEnrollmentAction({
        code: values.code,
      });
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      reset();
      setEnrollState({ step: "done" });
      toast.success(t("mfaEnabled"));
      onDone();
    });
  }

  if (enrollState.step === "qr") {
    return (
      <div className="flex flex-col gap-4 border border-border bg-card p-4">
        <div>
          <p className="text-sm font-medium">{t("mfaScanHeading")}</p>
          <p className="text-xs text-muted-foreground">{t("mfaScanHint")}</p>
        </div>

        {/* QR code */}
        <div className="flex justify-start">
          <div className="relative size-40 border border-border bg-white">
            <NextImage
              src={enrollState.qrCode}
              alt={t("mfaQrAlt")}
              fill
              unoptimized
              className="object-contain"
            />
          </div>
        </div>

        {/* Secret key — accessible fallback */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("mfaSecretLabel")}
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all border border-border bg-muted px-2 py-1.5 font-mono text-xs">
              {enrollState.secret}
            </code>
            <CopyButton text={enrollState.secret} />
          </div>
          <p className="text-xs text-muted-foreground">{t("mfaSecretHint")}</p>
        </div>

        {/* Verification form */}
        <form
          onSubmit={handleSubmit(handleVerify)}
          noValidate
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mfa-code">{t("mfaCodeLabel")}</Label>
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              disabled={verifyPending}
              aria-describedby={errors.code ? "mfa-code-error" : undefined}
              aria-invalid={!!errors.code}
              {...register("code")}
            />
            {errors.code && (
              <p
                id="mfa-code-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.code.message}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={verifyPending}
              className="min-h-11 min-w-32"
            >
              {verifyPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  {t("verifying")}
                </>
              ) : (
                t("verifyCode")
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={verifyPending}
              onClick={() => setEnrollState({ step: "idle" })}
              className="min-h-11"
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={enrollPending}
      onClick={handleStartSetup}
      className="min-h-11"
    >
      {enrollPending ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          {t("mfaStarting")}
        </>
      ) : (
        <>
          <ShieldCheck className="mr-2 size-4" aria-hidden />
          {t("mfaSetup")}
        </>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Security panel
// ---------------------------------------------------------------------------

type Props = {
  mfaEnabled: boolean;
};

export function SecurityPanel({ mfaEnabled: initialMfaEnabled }: Props) {
  const t = useTranslations("app.settings.security");
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled);
  const [disablePending, startDisable] = useTransition();

  function handleDisable() {
    startDisable(async () => {
      const result = await disableMfaAction();
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      setMfaEnabled(false);
      toast.success(t("mfaDisabled"));
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("mfaSection")}</h2>
          <p className="text-sm text-muted-foreground">{t("mfaHint")}</p>
        </div>

        {mfaEnabled ? (
          <div className="flex flex-col gap-4">
            {/* Status badge */}
            <div className="flex items-center gap-2 border border-border bg-card px-4 py-3">
              <ShieldCheck className="size-4 shrink-0 text-foreground" aria-hidden />
              <span className="text-sm font-medium">{t("mfaEnabledLabel")}</span>
              <span className="ml-auto inline-flex items-center border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("enabled")}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={disablePending}
              onClick={handleDisable}
              className="min-h-11 self-start text-destructive hover:text-destructive"
              aria-label={t("mfaDisableAriaLabel")}
            >
              {disablePending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  {t("disabling")}
                </>
              ) : (
                <>
                  <ShieldOff className="mr-2 size-4" aria-hidden />
                  {t("mfaDisable")}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Status badge */}
            <div className="flex items-center gap-2 border border-border bg-card px-4 py-3">
              <ShieldOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-sm text-muted-foreground">
                {t("mfaNotEnabledLabel")}
              </span>
            </div>

            <MfaSetupFlow
              onDone={() => setMfaEnabled(true)}
              t={t}
            />
          </div>
        )}
      </section>
    </div>
  );
}
