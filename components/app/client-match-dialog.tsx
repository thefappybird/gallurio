"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { reconcileClient, type ReconciledField } from "@/lib/clients/reconcile";

/** Plain, serializable shape a candidate match is returned as across the Server Action boundary. */
export type ClientMatchCard = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  bookingsCount: number;
  lastBookingAt: string | null;
};

type TypedClient = { name: string; email: string | null; phone: string | null; notes: string; tags: string[] };

export type ClientMatchResolution =
  | { clientId: string; picks: Record<string, "existing" | "typed"> }
  | { createNew: true };

type Props = {
  open: boolean;
  matches: ClientMatchCard[];
  typed: TypedClient;
  mode: "create" | "link";
  onResolve: (result: ClientMatchResolution) => void;
  onCancel: () => void;
};

const ESCAPE_VALUE = "new";

export function ClientMatchDialog({ open, matches, typed, mode, onResolve, onCancel }: Props) {
  const t = useTranslations("app.clients.matchDialog");
  const tField = useTranslations("app.clients.form");

  const [selection, setSelection] = useState<string | null>(null);
  const [reconcile, setReconcile] = useState<ReturnType<typeof reconcileClient> | null>(null);
  const [picks, setPicks] = useState<Record<string, "existing" | "typed">>({});

  // Reset local wizard state whenever the dialog closes so the next open starts
  // clean. Adjusting state during render (rather than in an effect) on the
  // `open` transition is the pattern React recommends for this.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setSelection(null);
      setReconcile(null);
      setPicks({});
    }
  }

  function handleStep1Submit() {
    if (!selection) return;
    if (selection === ESCAPE_VALUE) {
      onResolve({ createNew: true });
      return;
    }
    const card = matches.find((m) => m.id === selection);
    if (!card) return;
    const result = reconcileClient(
      { name: card.name, email: card.email, phone: card.phone, notes: card.notes, tags: card.tags },
      typed
    );
    if (result.conflicts.length === 0) {
      onResolve({ clientId: card.id, picks: {} });
      return;
    }
    setReconcile(result);
    setPicks(Object.fromEntries(result.conflicts.map((c) => [c.field, "existing"])));
  }

  const submitLabel = mode === "create" ? t("submitCreate") : t("submitLink");
  const escapeLabel = mode === "create" ? t("escapeCreate") : t("escapeLink");
  const selectedCard = matches.find((m) => m.id === selection) ?? null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-lg">
        {reconcile && selectedCard ? (
          <>
            <DialogTitle>{t("reconcileTitle", { count: reconcile.conflicts.length })}</DialogTitle>
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
              {reconcile.conflicts.map((c) => (
                <fieldset key={c.field} className="flex flex-col gap-2">
                  <legend className="text-sm font-medium text-foreground">{tField(c.field as ReconciledField)}</legend>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                    <label className="flex flex-1 items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name={`client-match-pick-${c.field}`}
                        checked={picks[c.field] !== "typed"}
                        onChange={() => setPicks((p) => ({ ...p, [c.field]: "existing" }))}
                        className="mt-0.5 accent-primary"
                        aria-label={c.existingValue}
                      />
                      <span>
                        <span className="block text-xs text-muted-foreground">{t("current")}</span>
                        {c.existingValue}
                      </span>
                    </label>
                    <label className="flex flex-1 items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name={`client-match-pick-${c.field}`}
                        checked={picks[c.field] === "typed"}
                        onChange={() => setPicks((p) => ({ ...p, [c.field]: "typed" }))}
                        className="mt-0.5 accent-primary"
                        aria-label={c.typedValue}
                      />
                      <span>
                        <span className="block text-xs text-muted-foreground">{t("typed")}</span>
                        {c.typedValue}
                      </span>
                    </label>
                  </div>
                </fieldset>
              ))}
              {reconcile.additive.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">{t("additiveTitle")}</p>
                  <ul className="mt-1 flex flex-col gap-1 text-sm text-foreground">
                    {reconcile.additive.map((a) => (
                      <li key={a.field}>
                        {tField(a.field as ReconciledField)}: {a.value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter className="static mx-0 mb-0 border-t-0 bg-transparent p-0 sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={onCancel} className="min-h-11 sm:min-h-0">
                {t("cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onResolve({ clientId: selectedCard.id, picks })}
                className="min-h-11 sm:min-h-0"
              >
                {submitLabel}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogTitle>{t("title")}</DialogTitle>
            <div role="radiogroup" aria-label={t("title")} className="flex min-h-0 flex-col gap-2 overflow-y-auto">
              {matches.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border p-3",
                    selection === m.id ? "border-primary ring-1 ring-primary" : "border-input"
                  )}
                >
                  <input
                    type="radio"
                    name="client-match-selection"
                    checked={selection === m.id}
                    onChange={() => setSelection(m.id)}
                    className="mt-1 accent-primary"
                    aria-label={m.name}
                  />
                  <span className="flex flex-col gap-0.5 text-sm">
                    <span className="font-medium text-foreground">{m.name}</span>
                    {m.email && <span className="text-muted-foreground">{m.email}</span>}
                    {m.phone && <span className="text-muted-foreground">{m.phone}</span>}
                    <span className="text-xs text-muted-foreground">{t("bookingsCount", { count: m.bookingsCount })}</span>
                  </span>
                </label>
              ))}
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border p-3",
                  selection === ESCAPE_VALUE ? "border-primary ring-1 ring-primary" : "border-input"
                )}
              >
                <input
                  type="radio"
                  name="client-match-selection"
                  checked={selection === ESCAPE_VALUE}
                  onChange={() => setSelection(ESCAPE_VALUE)}
                  className="accent-primary"
                  aria-label={escapeLabel}
                />
                <span className="text-sm font-medium text-foreground">{escapeLabel}</span>
              </label>
            </div>
            <DialogFooter className="static mx-0 mb-0 border-t-0 bg-transparent p-0 sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={onCancel} className="min-h-11 sm:min-h-0">
                {t("cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleStep1Submit}
                disabled={!selection}
                className="min-h-11 sm:min-h-0"
              >
                {submitLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
