"use client";

import { useState } from "react";
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
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Padding
            </span>
            <DimensionInput
              label="Padding X"
              value={s.paddingX}
              onChange={(v) => set({ paddingX: v })}
            />
            <DimensionInput
              label="Padding Y"
              value={s.paddingY}
              onChange={(v) => set({ paddingY: v })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Margin
            </span>
            <DimensionInput
              label="Margin X"
              value={s.marginX}
              onChange={(v) => set({ marginX: v })}
            />
            <DimensionInput
              label="Margin Y"
              value={s.marginY}
              onChange={(v) => set({ marginY: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
