"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorSwatchRow, NumberInputRow, DimensionInput } from "./toolbarPrimitives";
import type { RootPageStyle } from "./rootStyle";

type Tab = "design" | "layout";

const TAB_LABELS: Record<Tab, string> = {
  design: "Design",
  layout: "Layout",
};

export function RootStyleField({
  value,
  onChange,
}: {
  value: RootPageStyle | undefined;
  onChange: (v: RootPageStyle) => void;
}) {
  const [tab, setTab] = useState<Tab>("design");
  const [paddingAdvanced, setPaddingAdvanced] = useState(false);
  const [marginAdvanced, setMarginAdvanced] = useState(false);
  const s = value ?? {};
  const set = (patch: Partial<RootPageStyle>) => onChange({ ...s, ...patch });

  return (
    <div className="flex flex-col">
      <div className="flex border-b border-border">
        {(["design", "layout"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              tab === id
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground",
            )}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </div>

      {tab === "design" && (
        <div className="flex flex-col gap-4 p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Background color</span>
            <ColorSwatchRow
              value={s.bgColorToken}
              onChange={(t) => set({ bgColorToken: t })}
            />
          </div>
          <NumberInputRow
            label="Background opacity"
            value={s.bgOpacity}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => set({ bgOpacity: v })}
          />
        </div>
      )}

      {tab === "layout" && (
        <div className="flex flex-col gap-4 p-3">
          {/* Padding section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Padding
              </span>
              <button
                type="button"
                aria-label="Padding advanced options"
                onClick={() => setPaddingAdvanced((a) => !a)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Advanced
                {paddingAdvanced ? (
                  <ChevronUp className="size-3" aria-hidden />
                ) : (
                  <ChevronDown className="size-3" aria-hidden />
                )}
              </button>
            </div>
            {paddingAdvanced ? (
              <div className="flex flex-col gap-2">
                <DimensionInput
                  label="Top"
                  value={s.paddingTop}
                  onChange={(v) => set({ paddingTop: v })}
                />
                <DimensionInput
                  label="Right"
                  value={s.paddingRight}
                  onChange={(v) => set({ paddingRight: v })}
                />
                <DimensionInput
                  label="Bottom"
                  value={s.paddingBottom}
                  onChange={(v) => set({ paddingBottom: v })}
                />
                <DimensionInput
                  label="Left"
                  value={s.paddingLeft}
                  onChange={(v) => set({ paddingLeft: v })}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <DimensionInput
                  label="Horizontal (X)"
                  value={
                    (s.paddingLeft !== undefined && s.paddingLeft === s.paddingRight
                      ? s.paddingLeft
                      : undefined) ?? s.paddingX
                  }
                  onChange={(v) => set({ paddingLeft: v, paddingRight: v, paddingX: undefined })}
                />
                <DimensionInput
                  label="Vertical (Y)"
                  value={
                    (s.paddingTop !== undefined && s.paddingTop === s.paddingBottom
                      ? s.paddingTop
                      : undefined) ?? s.paddingY
                  }
                  onChange={(v) => set({ paddingTop: v, paddingBottom: v, paddingY: undefined })}
                />
              </div>
            )}
          </div>

          {/* Margin section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Margin
              </span>
              <button
                type="button"
                aria-label="Margin advanced options"
                onClick={() => setMarginAdvanced((a) => !a)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Advanced
                {marginAdvanced ? (
                  <ChevronUp className="size-3" aria-hidden />
                ) : (
                  <ChevronDown className="size-3" aria-hidden />
                )}
              </button>
            </div>
            {marginAdvanced ? (
              <div className="flex flex-col gap-2">
                <DimensionInput
                  label="Top"
                  value={s.marginTop}
                  onChange={(v) => set({ marginTop: v })}
                />
                <DimensionInput
                  label="Right"
                  value={s.marginRight}
                  onChange={(v) => set({ marginRight: v })}
                />
                <DimensionInput
                  label="Bottom"
                  value={s.marginBottom}
                  onChange={(v) => set({ marginBottom: v })}
                />
                <DimensionInput
                  label="Left"
                  value={s.marginLeft}
                  onChange={(v) => set({ marginLeft: v })}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <DimensionInput
                  label="Horizontal (X)"
                  value={
                    (s.marginLeft !== undefined && s.marginLeft === s.marginRight
                      ? s.marginLeft
                      : undefined) ?? s.marginX
                  }
                  onChange={(v) => set({ marginLeft: v, marginRight: v, marginX: undefined })}
                />
                <DimensionInput
                  label="Vertical (Y)"
                  value={
                    (s.marginTop !== undefined && s.marginTop === s.marginBottom
                      ? s.marginTop
                      : undefined) ?? s.marginY
                  }
                  onChange={(v) => set({ marginTop: v, marginBottom: v, marginY: undefined })}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
