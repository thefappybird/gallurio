/**
 * Shared recharts `<Tooltip>` styling. Every dashboard chart spreads this so the
 * tooltip text follows the theme in BOTH light and dark mode.
 *
 * The bug this fixes: recharts colors each tooltip *item* with its series/Cell
 * color by default. Charts that set only `contentStyle.color` (not `itemStyle` /
 * `labelStyle`) render item text in the series color — e.g. dark team-colored
 * bars produced near-black tooltip text that vanished on the dark popover.
 * Pinning item + label to `--popover-foreground` keeps text readable regardless
 * of series color.
 *
 * Usage: `<Tooltip {...CHART_TOOLTIP} formatter={...} />`
 */
export const CHART_TOOLTIP = {
  cursor: { fill: "var(--muted)", fillOpacity: 0.4 },
  wrapperStyle: { zIndex: 50, outline: "none" },
  contentStyle: {
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: 0,
    fontSize: 12,
    padding: "6px 10px",
  },
  itemStyle: { color: "var(--popover-foreground)" },
  labelStyle: { color: "var(--popover-foreground)" },
} as const;
