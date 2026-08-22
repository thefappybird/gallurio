"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { verifyCheckoutReturnAction } from "@/lib/actions/billing";
import { Button } from "@/components/ui/button";

export function BillingVerification({ returnTo }: { returnTo: string }) {
  const t = useTranslations("subscribe.verification");
  const [state, setState] = useState<"verifying" | "pending">("verifying");

  function applyResult(result: { ok: boolean }) {
    if (result.ok) {
      window.location.assign(returnTo);
      return;
    }
    setState("pending");
  }

  async function retry() {
    setState("verifying");
    applyResult(await verifyCheckoutReturnAction());
  }

  useEffect(() => {
    let active = true;
    void verifyCheckoutReturnAction().then((result) => {
      if (active) applyResult(result);
    });
    return () => { active = false; };
  // `applyResult` only closes over returnTo, which is the dependency here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnTo]);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <section className="w-full max-w-md border border-border bg-background p-8 text-center">
        {state === "verifying" ? (
          <>
            <Loader2 className="mx-auto mb-4 size-7 animate-spin text-brand" aria-hidden />
            <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-xl font-semibold">{t("pendingTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("pendingDescription")}</p>
            <Button className="mt-6" onClick={retry}>{t("retry")}</Button>
          </>
        )}
      </section>
    </main>
  );
}
