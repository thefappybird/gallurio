"use client";

/**
 * RichTextField — a Puck custom field for a single styleable text value.
 *
 * Renders the text input plus a compact format toolbar (bold/italic/underline,
 * alignment, font family, size, text color, highlight). The toolbar is hidden
 * until the field is ACTIVE (input or one of its controls holds focus), so a
 * block with several text fields stays uncluttered — only the field you're
 * editing shows its controls. All controls live inside the wrapper (no portals)
 * so focus tracking is robust for both pointer and keyboard users.
 *
 * Stored value is a `RichText` ({ text, style }); a legacy plain string coerces
 * via `coerceRichText`, so no DB migration is needed.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import { useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Baseline,
} from "lucide-react";
import { ToolbarToggle, ColorSwatchRow } from "./toolbarPrimitives";
import {
  coerceRichText,
  STYLE_LIMITS,
  type RichText,
  type TextStyle,
  type TextAlign,
} from "./styleToolkit";
import { PORTFOLIO_FONT_KEYS, PORTFOLIO_FONTS, type PortfolioFontKey } from "./fonts";

const ALIGNS: { value: TextAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "Align left", Icon: AlignLeft },
  { value: "center", label: "Align center", Icon: AlignCenter },
  { value: "right", label: "Align right", Icon: AlignRight },
];

export function RichTextField({
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  value: unknown;
  onChange: (next: RichText) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const rt = coerceRichText(value);
  const style: TextStyle = rt.style ?? {};
  const [active, setActive] = useState(false);

  const setText = (text: string) => onChange({ ...rt, text });
  const setStyle = (patch: Partial<TextStyle>) => onChange({ ...rt, style: { ...style, ...patch } });

  const inputClass =
    "w-full border border-border bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div
      className="flex flex-col gap-1.5"
      onFocus={() => setActive(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(false);
      }}
    >
      {multiline ? (
        <textarea
          rows={3}
          value={rt.text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          className={inputClass}
        />
      ) : (
        <input
          type="text"
          value={rt.text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          className={inputClass}
        />
      )}

      {active && (
        <div className="flex flex-col gap-1.5 border border-border bg-card p-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <ToolbarToggle active={!!style.bold} title="Bold" Icon={Bold} onClick={() => setStyle({ bold: !style.bold })} />
            <ToolbarToggle
              active={!!style.italic}
              title="Italic"
              Icon={Italic}
              onClick={() => setStyle({ italic: !style.italic })}
            />
            <ToolbarToggle
              active={!!style.underline}
              title="Underline"
              Icon={Underline}
              onClick={() => setStyle({ underline: !style.underline })}
            />
            <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
            {ALIGNS.map(({ value: a, label, Icon }) => (
              <ToolbarToggle
                key={a}
                active={style.align === a}
                title={label}
                Icon={Icon}
                onClick={() => setStyle({ align: style.align === a ? undefined : a })}
              />
            ))}
            <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
            <select
              aria-label="Font"
              value={style.fontFamily ?? ""}
              onChange={(e) =>
                setStyle({ fontFamily: e.target.value ? (e.target.value as PortfolioFontKey) : undefined })
              }
              className="h-9 cursor-pointer border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Theme font</option>
              {PORTFOLIO_FONT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PORTFOLIO_FONTS[key].label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="sr-only">Text size</span>
              <input
                type="number"
                inputMode="numeric"
                aria-label="Text size (px)"
                min={STYLE_LIMITS.fontSize.min}
                max={STYLE_LIMITS.fontSize.max}
                value={style.fontSize ?? ""}
                placeholder="Size"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return setStyle({ fontSize: undefined });
                  const n = Number(raw);
                  if (Number.isFinite(n)) setStyle({ fontSize: n });
                }}
                onBlur={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return;
                  const n = Number(raw);
                  setStyle({
                    fontSize: Number.isFinite(n)
                      ? Math.min(STYLE_LIMITS.fontSize.max, Math.max(STYLE_LIMITS.fontSize.min, n))
                      : undefined,
                  });
                }}
                className="h-9 w-16 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-1.5">
              <Baseline className="size-4 text-muted-foreground" aria-hidden />
              <ColorSwatchRow value={style.textColorToken} onChange={(t) => setStyle({ textColorToken: t })} />
            </div>
            <div className="flex items-center gap-1.5">
              <Highlighter className="size-4 text-muted-foreground" aria-hidden />
              <ColorSwatchRow value={style.highlightColorToken} onChange={(t) => setStyle({ highlightColorToken: t })} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
