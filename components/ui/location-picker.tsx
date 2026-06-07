"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Loader2Icon, MapPinIcon, SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => (
    <div className="h-56 w-full animate-pulse bg-muted sm:h-64" aria-hidden />
  ),
});

export type LocationValue = {
  address: string;
  lat: number | null;
  lng: number | null;
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type Props = {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  disabled?: boolean;
  id?: string;
  compact?: boolean;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export function LocationPicker({ value, onChange, disabled, id, compact }: Props) {
  const t = useTranslations("app.bookings.locationPicker");
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-results`;

  const [query, setQuery] = useState(value.address ?? "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const skipNextSearchRef = useRef(false);

  // Debounced geocoding search. A trailing-edge debounce keeps us well under
  // Nominatim's ~1 req/sec courtesy limit during typing.
  useEffect(() => {
    if (disabled) return;
    const term = query.trim();
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    if (term.length < 3) {
      // Defer the reset out of the effect body (microtask) to avoid the
      // cascading-render lint rule — same pattern used across the app.
      Promise.resolve().then(() => {
        setResults([]);
        setSearched(false);
        setSearching(false);
      });
      return;
    }

    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const url = `${NOMINATIM_URL}?format=jsonv2&limit=5&q=${encodeURIComponent(term)}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
        setSearched(true);
        setOpen(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[LocationPicker] geocoding failed", err);
        setResults([]);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(handle);
  }, [query, disabled]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function commitAddress(address: string) {
    if (address === value.address) return;
    onChange({ ...value, address });
  }

  function selectResult(r: NominatimResult) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    // Clamp to the schema's max(240) and keep the visible input in sync, so the
    // subsequent onBlur doesn't re-commit a longer string the server rejects.
    const address = r.display_name.slice(0, 240);
    skipNextSearchRef.current = true;
    setQuery(address);
    setOpen(false);
    setResults([]);
    onChange({ address, lat, lng });
  }

  function handlePin(lat: number, lng: number) {
    onChange({ ...value, lat, lng });
  }

  function clear() {
    skipNextSearchRef.current = true;
    setQuery("");
    setResults([]);
    setOpen(false);
    setSearched(false);
    onChange({ address: "", lat: null, lng: null });
  }

  const hasValue = !!value.address || value.lat != null;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={inputId}
            type="text"
            value={query}
            disabled={disabled}
            maxLength={240}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            placeholder={t("searchPlaceholder")}
            className="pl-8 pr-16"
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => commitAddress(query.trim())}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {searching ? (
              <Loader2Icon
                className="size-4 animate-spin text-muted-foreground"
                aria-label={t("searching")}
              />
            ) : null}
            {hasValue && !disabled ? (
              <button
                type="button"
                onClick={clear}
                aria-label={t("clear")}
                className="inline-flex size-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
              >
                <XIcon className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {open && (searched || results.length > 0) ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-1100 mt-1 max-h-56 w-full overflow-y-auto border border-border bg-popover text-popover-foreground shadow-md"
          >
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {t("noResults")}
              </li>
            ) : (
              results.map((r) => (
                <li key={r.place_id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    // onMouseDown (not onClick) so selection fires before the
                    // input's onBlur clears/commits and tears down the list.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectResult(r);
                    }}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">{r.display_name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      <div className="overflow-hidden border border-border">
        <LocationMap
          lat={value.lat}
          lng={value.lng}
          onPick={handlePin}
          disabled={disabled}
          compact={compact}
        />
      </div>

      <p className={cn("text-xs text-muted-foreground", disabled && "opacity-60")}>
        {t("dragHint")}
      </p>
    </div>
  );
}
