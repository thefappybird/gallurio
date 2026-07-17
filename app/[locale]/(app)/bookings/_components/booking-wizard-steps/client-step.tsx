"use client";

import { useMemo, useState } from "react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { useTranslations } from "next-intl";
import { SearchIcon, CheckIcon, UsersIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { WizardValues } from "./types";

export type ClientHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Props = {
  control: Control<WizardValues>;
  errors: FieldErrors<WizardValues>;
  readOnly?: boolean;
  readOnlyClientName?: string;
  /** Pre-fetched client list for synchronous filtering (no network on keystroke). */
  clients?: ClientHit[];
  /** True only after the user has tried to advance from this step. */
  showExistingError?: boolean;
};

export function ClientStep({
  control,
  errors,
  readOnly,
  readOnlyClientName,
  clients = [],
  showExistingError = false,
}: Props) {
  const t = useTranslations("app.bookings.wizard.client");

  if (readOnly) {
    return (
      <div className="flex flex-col gap-2 border border-border bg-muted/30 p-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("readOnlyLabel")}
        </span>
        <span className="text-sm font-medium">{readOnlyClientName ?? "—"}</span>
        <p className="text-xs text-muted-foreground">{t("readOnlyHint")}</p>
      </div>
    );
  }

  return (
    <Controller
      control={control}
      name="client"
      render={({ field }) => (
        <ClientPicker
          value={field.value}
          onChange={field.onChange}
          errors={errors}
          clients={clients}
          showExistingError={showExistingError}
        />
      )}
    />
  );
}

function ClientPicker({
  value,
  onChange,
  errors,
  clients,
  showExistingError,
}: {
  value: WizardValues["client"];
  onChange: (next: WizardValues["client"]) => void;
  errors: FieldErrors<WizardValues>;
  clients: ClientHit[];
  showExistingError: boolean;
}) {
  const t = useTranslations("app.bookings.wizard.client");
  const tClients = useTranslations("app.clients");
  const [query, setQuery] = useState("");

  const isNew = value.mode === "new";

  // Client-side filtering — no network call on keystroke. The full list is
  // pre-fetched once and passed down via the `clients` prop.
  const results = useMemo(() => {
    if (isNew) return [];
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 10);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 10);
  }, [clients, query, isNew]);

  const selectedId = useMemo(
    () => (value.mode === "existing" ? value.clientId : null),
    [value]
  );
  const newClient = value.mode === "new" ? value : null;
  const setNewClient = (patch: Partial<Extract<WizardValues["client"], { mode: "new" }>>) =>
    onChange({
      mode: "new",
      name: newClient?.name ?? "",
      email: newClient?.email ?? "",
      phone: newClient?.phone ?? "",
      source: newClient?.source ?? "manual",
      tags: newClient?.tags ?? [],
      notes: newClient?.notes ?? "",
      ...patch,
    });

  const switchToNew = () =>
    onChange({ mode: "new", name: "", email: "", phone: "", source: "manual", tags: [], notes: "" });

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex w-fit border border-border bg-background text-xs">
        <button
          type="button"
          onClick={() =>
            onChange({ mode: "existing", clientId: "", clientName: "" })
          }
          className={cn(
            "px-3 py-1.5 font-medium transition-colors",
            !isNew ? "bg-foreground text-background" : "text-muted-foreground"
          )}
        >
          {t("tabExisting")}
        </button>
        <button
          type="button"
          onClick={() =>
            switchToNew()
          }
          className={cn(
            "px-3 py-1.5 font-medium transition-colors",
            isNew ? "bg-foreground text-background" : "text-muted-foreground"
          )}
        >
          {t("tabNew")}
        </button>
      </div>

      {!isNew ? (
        <div className="flex flex-col gap-2">
          {clients.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title={tClients("listEmpty")}
              description={tClients("listEmptyHint")}
              action={
                <Button type="button" size="sm" onClick={switchToNew}>
                  {tClients("toolbar.add")}
                </Button>
              }
              className="p-8"
            />
          ) : (
            <>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="ps-8"
            />
          </div>
          <div className="max-h-48 overflow-y-auto border border-border bg-background">
            {results.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {t("noResults")}
              </p>
            ) : (
              <ul className="flex flex-col">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          mode: "existing",
                          clientId: c.id,
                          clientName: c.name,
                        })
                      }
                      className={cn(
                        "flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-start text-sm transition-colors last:border-b-0 hover:bg-accent/40",
                        selectedId === c.id && "bg-accent text-accent-foreground"
                      )}
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{c.name}</span>
                        {c.email ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {c.email}
                          </span>
                        ) : null}
                      </span>
                      {selectedId === c.id ? (
                        <CheckIcon className="size-4 shrink-0" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {showExistingError && value.mode === "existing" && !value.clientId ? (
            <p className="text-xs text-destructive">{t("selectRequired")}</p>
          ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-new-name">{t("name")}</Label>
            <Input
              id="client-new-name"
              value={newClient?.name ?? ""}
              onChange={(e) => setNewClient({ name: e.target.value })}
              placeholder={t("namePlaceholder")}
            />
            {errors.client && "name" in (errors.client as object) ? (
              <p className="text-xs text-destructive">
                {(errors.client as { name?: { message?: string } }).name?.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-new-email">{t("email")}</Label>
            <Input
              id="client-new-email"
              type="email"
              value={newClient?.email ?? ""}
              onChange={(e) => setNewClient({ email: e.target.value })}
              placeholder={t("emailPlaceholder")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-new-phone">{t("phone")}</Label>
              <PhoneInput id="client-new-phone" value={newClient?.phone ?? ""} onChange={(phone) => setNewClient({ phone: phone ?? "" })} placeholder={t("phonePlaceholder")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tClients("form.source")}</Label>
              <Select value={newClient?.source ?? "manual"} onValueChange={(source) => source && setNewClient({ source: source as "form" | "manual" | "referral" | "import" })}>
                <SelectTrigger><SelectValue>{(source: string) => <span className="capitalize">{tClients(`sourceValues.${source}`)}</span>}</SelectValue></SelectTrigger>
                <SelectContent>{(["form", "manual", "referral", "import"] as const).map((source) => <SelectItem key={source} value={source}>{tClients(`sourceValues.${source}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{tClients("form.tags")}</Label>
            <Input placeholder={tClients("form.tagsPlaceholder")} onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== ",") return;
              e.preventDefault();
              const tag = e.currentTarget.value.trim().slice(0, 40);
              if (tag && !(newClient?.tags ?? []).includes(tag)) setNewClient({ tags: [...(newClient?.tags ?? []), tag] });
              e.currentTarget.value = "";
            }} />
            {(newClient?.tags?.length ?? 0) > 0 ? <div className="flex flex-wrap gap-1">{newClient!.tags!.map((tag) => <span key={tag} className="inline-flex items-center gap-1 border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{tag}<button type="button" onClick={() => setNewClient({ tags: newClient!.tags!.filter((item) => item !== tag) })} aria-label={tClients("form.removeTag", { tag })}><XIcon className="size-3" /></button></span>)}</div> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-new-notes">{tClients("form.notes")}</Label>
            <textarea id="client-new-notes" rows={3} value={newClient?.notes ?? ""} onChange={(e) => setNewClient({ notes: e.target.value })} placeholder={tClients("form.notesPlaceholder")} className="w-full resize-none border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          </div>
        </div>
      )}
    </div>
  );
}
