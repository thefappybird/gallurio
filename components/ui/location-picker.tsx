"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  searchEnabled?: boolean;
  id?: string;
  compact?: boolean;
  className?: string;
  editable?: boolean;
  startInDisplayMode?: boolean;
  labels?: {
    searchPlaceholder: string;
    searching: string;
    noResults: string;
    dragHint: string;
    clear: string;
    // editable-mode labels (optional)
    changeLocation?: string;
    accept?: string;
    cancel?: string;
    apply?: string;
    currentAddressLabel?: string;
  };
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

function sameLocation(a: LocationValue, b: LocationValue): boolean {
  return (
    (a.address?.trim() ?? "") === (b.address?.trim() ?? "") &&
    a.lat === b.lat &&
    a.lng === b.lng
  );
}

function isEmpty(v: LocationValue): boolean {
  return !v.address?.trim() && v.lat == null && v.lng == null;
}

function BaseLocationPicker({
  value,
  onChange,
  disabled,
  searchEnabled = true,
  id,
  compact,
  className,
  labels,
  editable,
  startInDisplayMode,
}: Props) {
  const resolvedLabels = labels ?? {
    searchPlaceholder: "Search venue or address",
    searching: "Searching",
    noResults: "No matches",
    dragHint: "Drag the pin to fine-tune the exact spot.",
    clear: "Clear location",
    changeLocation: "Change location",
    accept: "Accept",
    cancel: "Cancel",
    apply: "Apply",
    currentAddressLabel: "Selected location",
  };
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-results`;

  // ── editable mode state machine ──────────────────────────────────────────
  // Determine initial mode.  When editable=true we default to "display" if
  // startInDisplayMode is explicitly true OR the value already has content.
  // Otherwise we start in "edit" (empty-field scenario).
  const [mode, setMode] = useState<"display" | "edit">(() => {
    if (!editable) return "edit";
    if (startInDisplayMode !== undefined) return startInDisplayMode ? "display" : "edit";
    return !isEmpty(value) ? "display" : "edit";
  });
  const [draft, setDraft] = useState<LocationValue>(value);
  const committedRef = useRef<LocationValue>(value);

  // Captured once when entering edit mode: was the committed value empty?
  const [editOriginEmpty, setEditOriginEmpty] = useState<boolean>(() =>
    editable ? isEmpty(committedRef.current) : false,
  );

  const dirty = editable ? !sameLocation(draft, committedRef.current) : false;

  // Refs for focus management
  const changeLocationBtnRef = useRef<HTMLButtonElement | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);

  // ── commit helper ────────────────────────────────────────────────────────
  // When editable, writes go to draft; otherwise straight to onChange.
  const commit = useCallback(
    (next: LocationValue) => {
      if (editable) {
        setDraft(next);
      } else {
        onChange(next);
      }
    },
    [editable, onChange],
  );

  // ── external value sync ──────────────────────────────────────────────────
  // In display mode, keep committedRef + draft in sync with parent value.
  // In edit mode, do NOT clobber draft.
  useEffect(() => {
    if (!editable) return;
    if (mode === "display") {
      committedRef.current = value;
      setDraft(value);
      setQuery(value.address ?? "");  // sync search input for next edit session
    }
  }, [editable, mode, value]);

  // ── search / input state ─────────────────────────────────────────────────
  // Use draft.address as the source of truth for the query when in editable mode.
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
    if (disabled || !searchEnabled) return;
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
  }, [query, disabled, searchEnabled]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function commitAddress(address: string) {
    const source = editable ? draft : value;
    if (address === source.address) return;
    commit({ ...source, address });
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
    commit({ address, lat, lng });
  }

  async function handlePin(lat: number, lng: number) {
    // Show the pin immediately; the address fills in once reverse geocoding lands.
    const source = editable ? draft : value;
    commit({ ...source, lat, lng });
    if (disabled || !searchEnabled) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    try {
      const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Nominatim reverse ${res.status}`);
      const data = (await res.json()) as { display_name?: string };
      const address = (data.display_name ?? "").slice(0, 240);
      if (!address) return;
      // Keep the visible input in sync and suppress the forward-search effect that
      // the setQuery below would otherwise trigger.
      skipNextSearchRef.current = true;
      setQuery(address);
      setOpen(false);
      setResults([]);
      commit({ address, lat, lng });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[LocationPicker] reverse geocoding failed", err);
    } finally {
      setSearching(false);
    }
  }

  function clear() {
    skipNextSearchRef.current = true;
    setQuery("");
    setResults([]);
    setOpen(false);
    setSearched(false);
    commit({ address: "", lat: null, lng: null });
  }

  // ── focus: move into search input when entering edit mode ────────────────
  useEffect(() => {
    if (mode === "edit") {
      searchWrapperRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }
  }, [mode]);

  // ── editable-mode action handlers ────────────────────────────────────────

  function handleEnterEdit() {
    const origin = committedRef.current;
    setEditOriginEmpty(isEmpty(origin));
    setDraft(origin);
    setQuery(origin.address ?? "");
    setMode("edit");
  }

  function handleCommit() {
    // Commit draft to parent and return to display mode
    onChange(draft);
    committedRef.current = draft;
    setMode("display");
    Promise.resolve().then(() => changeLocationBtnRef.current?.focus());
  }

  function handleCancel() {
    // Revert to last committed value, no onChange call
    setDraft(committedRef.current);
    setQuery(committedRef.current.address ?? "");
    setResults([]);
    setOpen(false);
    setSearched(false);
    setMode("display");
    Promise.resolve().then(() => changeLocationBtnRef.current?.focus());
  }

  // ── display mode: the effective location to show ─────────────────────────
  // Use draft (state) rather than committedRef.current (ref) so React re-renders
  // when the committed value changes while in display mode.
  const displayValue = editable ? draft : value;
  const hasValue = editable
    ? !!draft.address || draft.lat != null
    : !!value.address || value.lat != null;

  // The map always reads from the correct source depending on mode
  const mapValue = editable ? draft : value;

  // ── display mode rendering ───────────────────────────────────────────────
  if (editable && mode === "display") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {resolvedLabels.currentAddressLabel ? (
          <p className="text-xs text-muted-foreground">
            {resolvedLabels.currentAddressLabel}
          </p>
        ) : null}
        <LocationDisplay value={displayValue} />
        <button
          ref={changeLocationBtnRef}
          type="button"
          disabled={disabled}
          onClick={handleEnterEdit}
          className="self-start text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {resolvedLabels.changeLocation ?? "Change location"}
        </button>
      </div>
    );
  }

  // ── edit mode rendering (existing UI + editable action buttons) ──────────
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div ref={searchWrapperRef} className="relative">
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
            placeholder={resolvedLabels.searchPlaceholder}
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
                aria-label={resolvedLabels.searching}
              />
            ) : null}
            {hasValue && !disabled ? (
              <button
                type="button"
                onClick={clear}
                aria-label={resolvedLabels.clear}
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
                {resolvedLabels.noResults}
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
          lat={mapValue.lat}
          lng={mapValue.lng}
          onPick={handlePin}
          disabled={disabled}
          compact={compact}
        />
      </div>

      <p className={cn("text-xs text-muted-foreground", disabled && "opacity-60")}>
        {resolvedLabels.dragHint}
      </p>

      {/* editable action buttons */}
      {editable ? (
        <div className="flex items-center gap-2">
          {editOriginEmpty ? (
            // Empty-origin: single Apply button
            <button
              type="button"
              disabled={disabled}
              onClick={handleCommit}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {resolvedLabels.apply ?? "Apply"}
            </button>
          ) : (
            // Populated-origin: Cancel always + Accept only when dirty
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={handleCancel}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {resolvedLabels.cancel ?? "Cancel"}
              </button>
              {dirty ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={handleCommit}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  {resolvedLabels.accept ?? "Accept"}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function IntlLocationPicker(props: Omit<Props, "labels">) {
  const t = useTranslations("app.bookings.locationPicker");

  return (
    <BaseLocationPicker
      {...props}
      labels={{
        searchPlaceholder: t("searchPlaceholder"),
        searching: t("searching"),
        noResults: t("noResults"),
        dragHint: t("dragHint"),
        clear: t("clear"),
        changeLocation: t("changeLocation"),
        accept: t("accept"),
        cancel: t("cancel"),
        apply: t("apply"),
        currentAddressLabel: t("currentAddressLabel"),
      }}
    />
  );
}

export function LocationPicker(props: Props) {
  if (props.labels) {
    return <BaseLocationPicker {...props} />;
  }
  return <IntlLocationPicker {...props} />;
}

// ── LocationDisplay ─────────────────────────────────────────────────────────
// Lightweight read-only display of a LocationValue. Safe to import in contexts
// where Leaflet must not be loaded (e.g. inquiry modals).
export function LocationDisplay({
  value,
  className,
}: {
  value: LocationValue;
  className?: string;
}) {
  const addr = value.address?.trim();
  return (
    <span className={cn("text-sm break-words", className)}>{addr || "—"}</span>
  );
}
