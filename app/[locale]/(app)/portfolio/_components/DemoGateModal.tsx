"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DEMO_PROMO_CODE,
  isDemoPromoClaimed,
  markDemoPromoClaimed,
  markDemoSignupIntent,
} from "@/lib/page-builder/demoSession";

/** Which demo restriction the visitor just hit. `null` = modal closed. */
export type DemoGateType = "imageCap" | "blockCap" | "publish" | "theme" | null;

type Props = {
  gate: DemoGateType;
  onClose: () => void;
};

const GATE_BODY_KEY: Record<Exclude<DemoGateType, null>, string> = {
  imageCap: "imageCap",
  blockCap: "blockCap",
  publish: "publish",
  theme: "theme",
};

/**
 * Single shared modal for all four Portfolio Maker demo upsell gates (image
 * cap, block cap, publish, theme customization). Shows the gate's own message,
 * plus — only the first time any gate is hit in the session — an appended
 * promo-code reveal line. Subsequent gate hits show only the gate's message.
 */
export function DemoGateModal({ gate, onClose }: Props) {
  const t = useTranslations("app.portfolioMakerDemo.gates");
  const [showPromo, setShowPromo] = useState(false);

  // Freeze the reveal decision the moment `gate` changes to a non-null value
  // (render-time state adjustment — the sanctioned "derive state from a prop
  // change" pattern, avoiding a setState-in-effect cascade). Checked before
  // the effect below marks it claimed, so this always sees the pre-claim value.
  const [prevGate, setPrevGate] = useState<DemoGateType>(null);
  if (gate !== prevGate) {
    setPrevGate(gate);
    if (gate) setShowPromo(!isDemoPromoClaimed());
  }

  // The actual claimed-flag write is an external-system side effect, not
  // React state — correctly belongs in an effect.
  useEffect(() => {
    if (gate && !isDemoPromoClaimed()) markDemoPromoClaimed();
  }, [gate]);

  function continueToAuth() {
    markDemoSignupIntent();
    onClose();
  }

  return (
    <Dialog open={gate !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {gate ? t(GATE_BODY_KEY[gate]) : ""}
            {showPromo ? ` ${t("promoReveal", { code: DEMO_PROMO_CODE })}` : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:flex-wrap">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("dismiss")}
          </Button>
          <Link
            href="/sign-in"
            className={buttonVariants({ variant: "outline" })}
            onClick={continueToAuth}
          >
            {t("signInCta")}
          </Link>
          <Link
            href="/sign-up"
            className={buttonVariants({ variant: "brand" })}
            onClick={continueToAuth}
          >
            {t("cta")}
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
