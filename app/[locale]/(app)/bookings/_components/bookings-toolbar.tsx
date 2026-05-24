"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, Link } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DownloadIcon, PlusIcon, SearchIcon, UploadIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/validators/booking";
import { CsvImportDialog } from "./csv-import-dialog";

const ALL = "__all__";

export function BookingsToolbar({ defaultCurrency }: { defaultCurrency: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.toolbar");
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    const next = searchParams.get("q") ?? "";
    Promise.resolve().then(() => setQ(next));
  }, [searchParams]);

  const status = searchParams.get("status") ?? ALL;
  const includeCancelled = searchParams.get("includeCancelled") === "1";

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [router, pathname, searchParams]
  );

  // debounce the search input
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => pushParams({ q: q || null }), 250);
    return () => clearTimeout(id);
  }, [q, searchParams, pushParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="pl-8"
          />
        </div>

        <Select<string>
          value={status}
          onValueChange={(v) =>
            pushParams({ status: !v || v === ALL ? null : v })
          }
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>
              {(value: string) =>
                !value || value === ALL ? (
                  <span>{t("statusAll")}</span>
                ) : (
                  <span className="capitalize">{value}</span>
                )
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("statusAll")}</SelectItem>
            {BOOKING_STATUSES.map((s: BookingStatus) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={includeCancelled}
            onCheckedChange={(v: boolean) =>
              pushParams({ includeCancelled: v ? "1" : null })
            }
          />
          <span className="select-none text-muted-foreground">
            {t("showCancelled")}
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <UploadIcon className="size-4" />
          {t("import")}
        </Button>
        <Button variant="outline" size="sm" disabled>
          <DownloadIcon className="size-4" />
          {t("export")}
        </Button>
        <CsvImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          defaultCurrency={defaultCurrency}
        />
        <Button
          size="sm"
          className="bg-brand text-brand-foreground hover:bg-brand/90"
          render={<Link href={`${pathname}?add=1`} />}
        >
          <PlusIcon className="size-4" />
          {t("add")}
        </Button>
      </div>
    </div>
  );
}
