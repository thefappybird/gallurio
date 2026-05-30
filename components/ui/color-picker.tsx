"use client";

import { HexColorPicker, HexColorInput } from "react-colorful";
import { cn } from "@/lib/utils";

export type ColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  /** Quick-pick swatches shown above the spectrum. */
  presets?: readonly string[];
  presetsLabel?: string;
  customLabel?: string;
  hexLabel?: string;
};

// react-colorful emits 3- or 6-digit hex; normalize to a stable lowercase
// 6-digit value so the stored color matches the validator and compares cleanly
// against preset swatches.
function normalizeHex(hex: string): string {
  const v = hex.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return v;
}

export function ColorPicker({
  value,
  onChange,
  disabled = false,
  presets,
  presetsLabel,
  customLabel,
  hexLabel,
}: ColorPickerProps) {
  const current = normalizeHex(value);
  const emit = (next: string) => onChange(normalizeHex(next));

  return (
    <div className="flex flex-col gap-3">
      {presets && presets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {presetsLabel && (
            <span className="text-xs text-muted-foreground">{presetsLabel}</span>
          )}
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={presetsLabel}
          >
            {presets.map((hex) => {
              const h = normalizeHex(hex);
              const selected = h === current;
              return (
                <button
                  key={hex}
                  type="button"
                  disabled={disabled}
                  onClick={() => emit(h)}
                  className="size-8 cursor-pointer border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50"
                  style={{
                    backgroundColor: h,
                    borderColor: selected ? "var(--foreground)" : "transparent",
                  }}
                  aria-label={hex}
                  aria-pressed={selected}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {customLabel && (
          <span className="text-xs text-muted-foreground">{customLabel}</span>
        )}
        <div
          className={cn(
            "flex flex-col gap-2",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <HexColorPicker color={current} onChange={emit} />
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-9 shrink-0 border border-border"
              style={{ backgroundColor: current }}
            />
            <label className="flex flex-1 items-center gap-1.5 border border-input bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring">
              <span aria-hidden="true" className="text-sm text-muted-foreground">
                #
              </span>
              <HexColorInput
                color={current}
                onChange={emit}
                disabled={disabled}
                className="w-full bg-transparent py-2.5 text-sm uppercase outline-none disabled:opacity-50"
                aria-label={hexLabel}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
