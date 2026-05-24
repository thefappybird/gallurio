"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { useTranslations } from "next-intl";
import { SearchIcon, CheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WizardValues } from "./types";

type ClientHit = {
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
};

export function ClientStep({
  control,
  errors,
  readOnly,
  readOnlyClientName,
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
        />
      )}
    />
  );
}

function ClientPicker({
  value,
  onChange,
  errors,
}: {
  value: WizardValues["client"];
  onChange: (next: WizardValues["client"]) => void;
  errors: FieldErrors<WizardValues>;
}) {
  const t = useTranslations("app.bookings.wizard.client");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientHit[]>([]);
  const [loading, setLoading] = useState(false);

  const isNew = value.mode === "new";

  // Debounced fetch when on Existing tab.
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    const q = query;
    const id = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      const url = `/api/clients?limit=10${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: ClientHit[]) => {
          if (cancelled) return;
          setResults(rows ?? []);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, isNew]);

  const selectedId = useMemo(
    () => (value.mode === "existing" ? value.clientId : null),
    [value]
  );

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
            onChange({ mode: "new", name: "", email: "", phone: "" })
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
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-8"
            />
          </div>
          <div className="max-h-48 overflow-y-auto border border-border bg-background">
            {loading ? (
              <div className="flex flex-col gap-1 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : results.length === 0 ? (
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
                        "flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/40",
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
          {value.mode === "existing" && !value.clientId ? (
            <p className="text-xs text-destructive">{t("selectRequired")}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="client-new-name">{t("name")}</Label>
            <Input
              id="client-new-name"
              value={value.mode === "new" ? value.name : ""}
              onChange={(e) =>
                onChange({
                  ...(value as Extract<WizardValues["client"], { mode: "new" }>),
                  name: e.target.value,
                })
              }
              placeholder={t("namePlaceholder")}
            />
            {errors.client && "name" in (errors.client as object) ? (
              <p className="text-xs text-destructive">
                {(errors.client as { name?: { message?: string } }).name?.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="client-new-email">{t("email")}</Label>
            <Input
              id="client-new-email"
              type="email"
              value={value.mode === "new" ? (value.email ?? "") : ""}
              onChange={(e) =>
                onChange({
                  ...(value as Extract<WizardValues["client"], { mode: "new" }>),
                  email: e.target.value,
                })
              }
              placeholder={t("emailPlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="client-new-phone">{t("phone")}</Label>
            <Input
              id="client-new-phone"
              type="tel"
              value={value.mode === "new" ? (value.phone ?? "") : ""}
              onChange={(e) =>
                onChange({
                  ...(value as Extract<WizardValues["client"], { mode: "new" }>),
                  phone: e.target.value,
                })
              }
              placeholder={t("phonePlaceholder")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
