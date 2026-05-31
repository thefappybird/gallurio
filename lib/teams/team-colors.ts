// Client-safe team color presets. This lives outside lib/db/models so client
// components (the color picker dialogs) can import the palette without pulling
// the Mongoose model — and therefore `mongoose` and Node built-ins — into the
// browser bundle. The Team model re-exports this for server/test convenience.
export const TEAM_COLOR_PALETTE = [
  "#0d7377", // brand teal
  "#7c5cff", // violet
  "#e87a4f", // terracotta
  "#c9aa55", // gold
  "#5fb3a8", // mint
  "#8a8b94", // slate
] as const;

// Calendar candle color for a booking whose team has been DEACTIVATED. A
// desaturated neutral that reads as "archival" in both light and dark themes and
// is visually distinct from every active team color above and from status
// colors. Used only in the "All teams" (team-color) calendar mode.
export const INACTIVE_TEAM_COLOR = "#4b5563";
